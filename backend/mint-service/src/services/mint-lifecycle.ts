import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { DatabaseClient, createChildLogger } from '@sss/shared';
import * as fs from 'fs';

const log = createChildLogger({ module: 'mint-lifecycle' });

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const AUTHORITY_KEYPAIR_PATH = process.env.AUTHORITY_KEYPAIR_PATH || '';
const AUTHORITY_KEYPAIR_JSON = process.env.AUTHORITY_KEYPAIR_JSON || '';

// Loads authority keypair from AUTHORITY_KEYPAIR_JSON (raw JSON) or
// AUTHORITY_KEYPAIR_PATH (file path). Use HSM/Vault in production.
function loadAuthorityKeypair(): Keypair {
    if (AUTHORITY_KEYPAIR_JSON) {
        const secretKey = Uint8Array.from(JSON.parse(AUTHORITY_KEYPAIR_JSON));
        return Keypair.fromSecretKey(secretKey);
    }

    if (AUTHORITY_KEYPAIR_PATH) {
        const raw = fs.readFileSync(AUTHORITY_KEYPAIR_PATH, 'utf-8');
        const secretKey = Uint8Array.from(JSON.parse(raw));
        return Keypair.fromSecretKey(secretKey);
    }

    throw new Error(
        'Authority keypair not configured. Set AUTHORITY_KEYPAIR_JSON or AUTHORITY_KEYPAIR_PATH environment variable.'
    );
}

// Mint lifecycle: pending → verified → executed | failed
// Each stage persists to DB. Failures logged + marked 'failed'.
export class MintLifecycle {
    constructor(private readonly db: DatabaseClient) { }
    async execute(
        requestId: string,
        mintAddress: string,
        recipient: string,
        amount: string,
    ): Promise<void> {
        log.info({ requestId, mintAddress, recipient, amount }, 'Starting mint lifecycle');

        try {
            // Stage 1: Verify the request
            await this.verify(requestId, mintAddress, recipient, amount);

            // Stage 2: Execute the on-chain transaction
            const txSignature = await this.executeOnChain(requestId, mintAddress, recipient, amount);

            // Stage 3: Mark as executed
            await this.db.updateMintRequestStatus(requestId, 'executed', txSignature);
            log.info({ requestId, txSignature }, 'Mint lifecycle completed successfully');
        } catch (err: any) {
            log.error({ err, requestId }, 'Mint lifecycle failed');
            await this.db.updateMintRequestStatus(requestId, 'failed');
            throw err;
        }
    }

    // Validates amount > 0 and addresses are valid base58.
    private async verify(
        requestId: string,
        mintAddress: string,
        recipient: string,
        amount: string,
    ): Promise<void> {
        log.info({ requestId }, 'Verifying mint request');

        const amountBig = BigInt(amount);
        if (amountBig <= 0n) {
            throw new Error('Amount must be greater than zero');
        }

        // Validate addresses are valid Solana public keys
        try {
            new PublicKey(recipient);
        } catch {
            throw new Error(`Invalid recipient address: ${recipient}`);
        }

        try {
            new PublicKey(mintAddress);
        } catch {
            throw new Error(`Invalid mint address: ${mintAddress}`);
        }

        await this.db.updateMintRequestStatus(requestId, 'verified');
        log.info({ requestId }, 'Mint request verified');
    }

    // Builds and submits the on-chain mint tx. Returns the tx signature.
    private async executeOnChain(
        requestId: string,
        mintAddress: string,
        recipient: string,
        amount: string,
    ): Promise<string> {
        log.info({ requestId, mintAddress, recipient, amount }, 'Executing on-chain mint');

        const connection = new Connection(RPC_URL, 'confirmed');
        const authority = loadAuthorityKeypair();

        // Build the mint instruction directly using Anchor
        const mintPubkey = new PublicKey(mintAddress);
        const recipientPubkey = new PublicKey(recipient);
        const amountBig = BigInt(amount);

        // Derive the config PDA
        const [configPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('config'), mintPubkey.toBuffer()],
            new PublicKey(process.env.PROGRAM_ID || '2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no')
        );

        // Derive the minter role PDA
        const minterRoleDiscriminator = Buffer.from([0]); // Minter = 0
        const [rolePda] = PublicKey.findProgramAddressSync(
            [Buffer.from('role'), mintPubkey.toBuffer(), authority.publicKey.toBuffer(), minterRoleDiscriminator],
            new PublicKey(process.env.PROGRAM_ID || '2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no')
        );

        const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } = await import('@solana/spl-token');
        const recipientAta = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey, true, TOKEN_2022_PROGRAM_ID);

        const { Transaction, sendAndConfirmTransaction, SystemProgram, SYSVAR_RENT_PUBKEY } = await import('@solana/web3.js');

        // Create ATA if it doesn't exist
        const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
            authority.publicKey,
            recipientAta,
            recipientPubkey,
            mintPubkey,
            TOKEN_2022_PROGRAM_ID,
        );

        // Build the Anchor mint instruction
        const programId = new PublicKey(process.env.PROGRAM_ID || '2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no');

        // Anchor instruction discriminator for "mint_tokens"
        const { createHash } = await import('crypto');
        const discriminator = createHash('sha256')
            .update('global:mint_tokens')
            .digest()
            .subarray(0, 8);

        // Encode amount as u64 LE
        const amountBuffer = Buffer.alloc(8);
        amountBuffer.writeBigUInt64LE(amountBig);

        const data = Buffer.concat([discriminator, amountBuffer]);

        const mintIx = {
            programId,
            keys: [
                { pubkey: authority.publicKey, isSigner: true, isWritable: true },
                { pubkey: mintPubkey, isSigner: false, isWritable: true },
                { pubkey: configPda, isSigner: false, isWritable: true },
                { pubkey: rolePda, isSigner: false, isWritable: true },
                { pubkey: recipientAta, isSigner: false, isWritable: true },
                { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data,
        };

        const tx = new Transaction().add(createAtaIx).add(mintIx);
        const signature = await sendAndConfirmTransaction(connection, tx, [authority], {
            commitment: 'confirmed',
        });

        log.info({ requestId, signature }, 'On-chain mint executed');
        return signature;
    }
}
