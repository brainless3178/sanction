import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, getAccount } from '@solana/spl-token';

const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || '2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no';

export const connection = new Connection(RPC_URL, 'confirmed');

// Deploys a new Token-2022 stablecoin mint via wallet adapter.
export async function createStablecoin(params: {
    preset: 'SSS_1' | 'SSS_2';
    name: string;
    symbol: string;
    decimals: number;
    uri?: string;
    wallet: any; // WalletContextState from @solana/wallet-adapter-react
}): Promise<{ mintAddress: string; txSignature: string }> {
    const { wallet, preset, name, symbol, decimals, uri } = params;

    if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
    }

    const provider = new AnchorProvider(connection, wallet as any, {
        commitment: 'confirmed',
    });

    const programId = new PublicKey(PROGRAM_ID);
    const mintKeypair = Keypair.generate();

    const enablePermanentDelegate = preset === 'SSS_2';
    const enableTransferHook = preset === 'SSS_2';

    // Derive config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config'), mintKeypair.publicKey.toBuffer()],
        programId
    );

    // Build the Anchor instruction discriminator for "initialize"
    const crypto = await import('crypto');
    const discriminator = crypto.createHash('sha256')
        .update('global:initialize')
        .digest()
        .subarray(0, 8);

    // Encode parameters
    const nameBytes = Buffer.from(name, 'utf-8');
    const symbolBytes = Buffer.from(symbol, 'utf-8');
    const uriBytes = Buffer.from(uri || '', 'utf-8');

    const data = Buffer.concat([
        discriminator,
        // name (string: 4-byte length + bytes)
        Buffer.from(new Uint32Array([nameBytes.length]).buffer),
        nameBytes,
        // symbol
        Buffer.from(new Uint32Array([symbolBytes.length]).buffer),
        symbolBytes,
        // uri
        Buffer.from(new Uint32Array([uriBytes.length]).buffer),
        uriBytes,
        // decimals (u8)
        Buffer.from([decimals]),
        // enable_permanent_delegate (bool)
        Buffer.from([enablePermanentDelegate ? 1 : 0]),
        // enable_transfer_hook (bool)
        Buffer.from([enableTransferHook ? 1 : 0]),
    ]);

    const { Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, sendAndConfirmTransaction } = await import('@solana/web3.js');

    const ix = {
        programId,
        keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data,
    };

    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.partialSign(mintKeypair);

    const signed = await wallet.signTransaction(tx);
    const txSignature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(txSignature, 'confirmed');

    return {
        mintAddress: mintKeypair.publicKey.toBase58(),
        txSignature,
    };
}

// Reads config PDA for totalMinted/totalBurned + on-chain supply.
export async function getSupplyInfo(mintAddress: string) {
    try {
        const mint = new PublicKey(mintAddress);
        const supply = await connection.getTokenSupply(mint);
        const programId = new PublicKey(PROGRAM_ID);

        // Derive config PDA and read it
        const [configPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('config'), mint.toBuffer()],
            programId
        );

        const accountInfo = await connection.getAccountInfo(configPda);
        if (accountInfo && accountInfo.data.length >= 8 + 32 + 32 + 8 + 8) {
            // Parse StablecoinConfig data (after 8-byte Anchor discriminator)
            const data = accountInfo.data;
            const offset = 8 + 32 + 32 + 32 + 4 + 32 + 4 + 10 + 4 + 200 + 1 + 1; // Skip to totalMinted field
            // Read totalMinted and totalBurned as u64 LE
            const totalMinted = data.readBigUInt64LE(offset);
            const totalBurned = data.readBigUInt64LE(offset + 8);
            const decimals = Number(supply.value.decimals);
            const divisor = 10n ** BigInt(decimals);

            return {
                circulating: supply.value.uiAmountString || '0',
                totalMinted: (totalMinted / divisor).toString(),
                totalBurned: (totalBurned / divisor).toString(),
            };
        }

        return {
            circulating: supply.value.uiAmountString || '0',
            totalMinted: supply.value.uiAmountString || '0',
            totalBurned: '0',
        };
    } catch {
        return { circulating: '0', totalMinted: '0', totalBurned: '0' };
    }
}

// Fetches all RoleAssignment PDAs where roleType=0 (Minter).
export async function getMinters(mintAddress: string): Promise<Array<{ address: string; quota: number; used: number }>> {
    try {
        const programId = new PublicKey(PROGRAM_ID);
        const mint = new PublicKey(mintAddress);

        // Fetch all RoleAssignment PDAs with "role" prefix + mint
        const accounts = await connection.getProgramAccounts(programId, {
            filters: [
                { memcmp: { offset: 0, bytes: '' } }, // Will match all program accounts
            ],
        });

        const minters: Array<{ address: string; quota: number; used: number }> = [];

        for (const { pubkey, account } of accounts) {
            const data = account.data;
            if (data.length < 8 + 32 + 32 + 1 + 8 + 8 + 8) continue;

            // Parse RoleAssignment: discriminator(8) + mint(32) + account(32) + roleType(1) + limit(8) + mintedThisPeriod(8) + periodStart(8)
            const roleType = data[8 + 32 + 32];
            if (roleType !== 0) continue; // 0 = Minter role

            const assignee = new PublicKey(data.subarray(8 + 32, 8 + 64));
            const limit = Number(data.readBigUInt64LE(8 + 64 + 1));
            const mintedThisPeriod = Number(data.readBigUInt64LE(8 + 64 + 1 + 8));

            minters.push({
                address: assignee.toBase58(),
                quota: limit,
                used: mintedThisPeriod,
            });
        }

        return minters;
    } catch {
        return [];
    }
}


export async function getBlacklistEntries(mintAddress: string): Promise<Array<{ address: string; reason: string; addedAt: string }>> {
    const baseUrl = import.meta.env.VITE_COMPLIANCE_API || 'http://localhost:3002';
    try {
        const res = await fetch(`${baseUrl}/api/blacklist?mintAddress=${mintAddress}`);
        const json = await res.json();
        return json.data || [];
    } catch {
        return [];
    }
}


export async function fetchAuditLog(
    mintAddress: string,
    format: 'json' | 'csv' = 'json',
    eventType?: string,
): Promise<any> {
    const baseUrl = import.meta.env.VITE_COMPLIANCE_API || 'http://localhost:3002';
    let url = `${baseUrl}/api/audit?mintAddress=${mintAddress}&format=${format}`;
    if (eventType) url += `&eventType=${eventType}`;
    const res = await fetch(url);
    if (format === 'csv') return res.text();
    return res.json();
}

// WebSocket subscription for real-time on-chain events. Returns unsubscribe fn.
export function subscribeToEvents(
    mintAddress: string,
    callback: (event: { time: string; type: string; detail: string }) => void,
): () => void {
    const programId = new PublicKey(PROGRAM_ID);
    const subId = connection.onLogs(programId, (logInfo) => {
        if (logInfo.err) return;

        let eventType: string | null = null;
        for (const line of logInfo.logs) {
            if (line.includes('TokensMinted')) eventType = 'MINT';
            else if (line.includes('TokensBurned')) eventType = 'BURN';
            else if (line.includes('AccountFrozen')) eventType = 'FREEZE';
            else if (line.includes('AccountThawed')) eventType = 'THAW';
            else if (line.includes('AddedToBlacklist')) eventType = 'BLACKLIST';
            else if (line.includes('RemovedFromBlacklist')) eventType = 'UNBLACKLIST';
            else if (line.includes('FundsSeized')) eventType = 'SEIZE';
            else if (line.includes('GlobalPauseSet')) eventType = 'PAUSE';
            else if (line.includes('RoleAssigned')) eventType = 'ROLE+';
            else if (line.includes('RoleRevoked')) eventType = 'ROLE-';
        }

        if (eventType) {
            const now = new Date();
            const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            callback({
                time,
                type: eventType,
                detail: logInfo.signature.slice(0, 12) + '...',
            });
        }
    }, 'confirmed');

    return () => {
        connection.removeOnLogsListener(subId).catch(() => { });
    };
}
