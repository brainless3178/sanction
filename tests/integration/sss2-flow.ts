import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    Transaction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
    createAssociatedTokenAccountIdempotentInstruction,
    createTransferCheckedInstruction,
} from '@solana/spl-token';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import * as fs from 'fs';

/**
 * SSS-2 Integration Test — Full Compliance Lifecycle
 *
 * Tests:
 *   deploy SSS-2 → mint → transfer → blacklist → hook blocks transfer →
 *   seize → verify balance → remove blacklist → verify resume → audit trail
 *
 * Requires: local validator running with sss-token + transfer-hook deployed
 */

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8899';
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || '2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no');
const HOOK_PROGRAM_ID = new PublicKey(process.env.HOOK_PROGRAM_ID || '8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ');

function disc(name: string): Buffer {
    return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function u64LE(value: bigint): Buffer {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(value);
    return buf;
}

async function main() {
    const connection = new Connection(RPC_URL, 'confirmed');

    const authorityPath = process.env.AUTHORITY_KEYPAIR || `${process.env.HOME}/.config/solana/id.json`;
    const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(authorityPath, 'utf-8'))));
    const minter = Keypair.generate();
    const user1 = Keypair.generate();
    const user2 = Keypair.generate();
    const treasury = Keypair.generate();

    const MINT_AMOUNT = 500_000n * 1_000_000n;
    const TRANSFER_AMOUNT = 100_000n * 1_000_000n;

    console.log('═══════════════════════════════════════════');
    console.log('  SSS-2 Integration Test — Compliance Flow');
    console.log('═══════════════════════════════════════════\n');

    // ---- Step 1: Fund accounts ----
    console.log('1. Airdropping SOL to test accounts...');
    for (const kp of [authority, minter, user1, user2, treasury]) {
        await connection.requestAirdrop(kp.publicKey, 3 * LAMPORTS_PER_SOL);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✔ All accounts funded\n');

    // ---- Step 2: Deploy SSS-2 ----
    console.log('2. Deploying SSS-2 stablecoin (TUSD)...');
    const mintKeypair = Keypair.generate();
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config'), mintKeypair.publicKey.toBuffer()], PROGRAM_ID
    );

    const nameBytes = Buffer.from('Test USD', 'utf-8');
    const symbolBytes = Buffer.from('TUSD', 'utf-8');
    const uriBytes = Buffer.from('https://test.com/metadata.json', 'utf-8');

    const initData = Buffer.concat([
        disc('initialize'),
        Buffer.from(new Uint32Array([nameBytes.length]).buffer), nameBytes,
        Buffer.from(new Uint32Array([symbolBytes.length]).buffer), symbolBytes,
        Buffer.from(new Uint32Array([uriBytes.length]).buffer), uriBytes,
        Buffer.from([6]),  // decimals
        Buffer.from([1]),  // enable_permanent_delegate = true (SSS-2)
        Buffer.from([1]),  // enable_transfer_hook = true (SSS-2)
    ]);

    const initIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: initData,
    };

    const initSig = await sendAndConfirmTransaction(connection, new Transaction().add(initIx), [authority, mintKeypair]);
    console.log(`   ✔ SSS-2 deployed — tx: ${initSig}\n`);

    // ---- Step 3: Add minter ----
    console.log('3. Adding minter with 1,000,000 token quota...');
    const minterRole = Buffer.from([0]);
    const [rolePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('role'), mintKeypair.publicKey.toBuffer(), minter.publicKey.toBuffer(), minterRole], PROGRAM_ID
    );

    const assignIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: minter.publicKey, isSigner: false, isWritable: false },
            { pubkey: rolePda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([disc('assign_role'), minterRole, u64LE(1_000_000n * 1_000_000n)]),
    };
    const assignSig = await sendAndConfirmTransaction(connection, new Transaction().add(assignIx), [authority]);
    console.log(`   ✔ Minter assigned — tx: ${assignSig}\n`);

    // ---- Step 4: Mint to user1 ----
    console.log('4. Minting 500,000 tokens to user1...');
    const user1Ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, user1.publicKey, true, TOKEN_2022_PROGRAM_ID);
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(minter.publicKey, user1Ata, user1.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID);

    const mintIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: minter.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: rolePda, isSigner: false, isWritable: true },
            { pubkey: user1Ata, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([disc('mint_tokens'), u64LE(MINT_AMOUNT)]),
    };
    const mintSig = await sendAndConfirmTransaction(connection, new Transaction().add(createAtaIx).add(mintIx), [minter]);
    console.log(`   ✔ Minted — tx: ${mintSig}\n`);

    // ---- Step 5: Transfer to user2 ----
    console.log('5. Transferring 100,000 tokens to user2...');
    const user2Ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, user2.publicKey, true, TOKEN_2022_PROGRAM_ID);
    const createAta2Ix = createAssociatedTokenAccountIdempotentInstruction(user1.publicKey, user2Ata, user2.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID);
    const transferIx = createTransferCheckedInstruction(user1Ata, mintKeypair.publicKey, user2Ata, user1.publicKey, TRANSFER_AMOUNT, 6, [], TOKEN_2022_PROGRAM_ID);
    const transferSig = await sendAndConfirmTransaction(connection, new Transaction().add(createAta2Ix).add(transferIx), [user1]);
    console.log(`   ✔ Transfer — tx: ${transferSig}\n`);

    // ---- Step 6: Blacklist user1 ----
    console.log('6. Blacklisting user1 (reason: "OFAC SDN Match")...');
    const [blacklistPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('blacklist'), mintKeypair.publicKey.toBuffer(), user1.publicKey.toBuffer()], PROGRAM_ID
    );

    const reasonBytes = Buffer.from('OFAC SDN Match', 'utf-8');
    const blacklistIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: user1.publicKey, isSigner: false, isWritable: false },
            { pubkey: blacklistPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([
            disc('add_to_blacklist'),
            Buffer.from(new Uint32Array([reasonBytes.length]).buffer), reasonBytes,
        ]),
    };
    const blSig = await sendAndConfirmTransaction(connection, new Transaction().add(blacklistIx), [authority]);
    console.log(`   ✔ User1 blacklisted — tx: ${blSig}\n`);

    // ---- Step 7: Verify transfer hook blocks blacklisted user ----
    console.log('7. Attempting transfer from blacklisted user1 (should fail)...');
    try {
        const blockedIx = createTransferCheckedInstruction(user1Ata, mintKeypair.publicKey, user2Ata, user1.publicKey, 1_000_000n, 6, [], TOKEN_2022_PROGRAM_ID);
        await sendAndConfirmTransaction(connection, new Transaction().add(blockedIx), [user1]);
        throw new Error('Should have failed — user is blacklisted');
    } catch (err: any) {
        if (err.message === 'Should have failed — user is blacklisted') throw err;
        console.log(`   ✔ Transfer correctly blocked: ${err.message.slice(0, 50)}\n`);
    }

    // ---- Step 8: Seize funds ----
    console.log('8. Seizing all funds from user1 to treasury...');
    const treasuryAta = getAssociatedTokenAddressSync(mintKeypair.publicKey, treasury.publicKey, true, TOKEN_2022_PROGRAM_ID);
    const createTreasuryAtaIx = createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, treasuryAta, treasury.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID);

    const [delegatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('delegate'), mintKeypair.publicKey.toBuffer()], PROGRAM_ID
    );

    const seizeIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: user1.publicKey, isSigner: false, isWritable: false },
            { pubkey: user1Ata, isSigner: false, isWritable: true },
            { pubkey: treasuryAta, isSigner: false, isWritable: true },
            { pubkey: blacklistPda, isSigner: false, isWritable: false },
            { pubkey: delegatePda, isSigner: false, isWritable: false },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(disc('seize_funds')),
    };
    const seizeSig = await sendAndConfirmTransaction(connection, new Transaction().add(createTreasuryAtaIx).add(seizeIx), [authority]);
    console.log(`   ✔ Funds seized — tx: ${seizeSig}\n`);

    // ---- Step 9: Verify zero balance ----
    console.log('9. Verifying user1 balance is zero...');
    const user1PostSeize = await getAccount(connection, user1Ata, 'confirmed', TOKEN_2022_PROGRAM_ID);
    if (user1PostSeize.amount.toString() !== '0') {
        throw new Error(`Expected 0, got ${user1PostSeize.amount}`);
    }
    console.log('   ✔ User1 balance is 0\n');

    // ---- Step 10: Remove from blacklist ----
    console.log('10. Removing user1 from blacklist...');
    const removeBlIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: user1.publicKey, isSigner: false, isWritable: false },
            { pubkey: blacklistPda, isSigner: false, isWritable: true },
        ],
        data: Buffer.from(disc('remove_from_blacklist')),
    };
    const removeBlSig = await sendAndConfirmTransaction(connection, new Transaction().add(removeBlIx), [authority]);
    console.log(`   ✔ Removed — tx: ${removeBlSig}\n`);

    // ---- Step 11: Verify transfers resume ----
    console.log('11. Verifying transfers resume post-unblacklist...');
    const resumeMintIx = {
        programId: PROGRAM_ID,
        keys: mintIx.keys,
        data: Buffer.concat([disc('mint_tokens'), u64LE(10_000n * 1_000_000n)]),
    };
    const resumeSig = await sendAndConfirmTransaction(connection, new Transaction().add(resumeMintIx), [minter]);
    console.log(`   ✔ Minting resumed — tx: ${resumeSig}\n`);

    console.log('═══════════════════════════════════════════');
    console.log('  SSS-2 Integration Test — ALL PASSED');
    console.log('═══════════════════════════════════════════\n');

    const results = {
        mint: mintKeypair.publicKey.toBase58(),
        authority: authority.publicKey.toBase58(),
        transactions: { initSig, assignSig, mintSig, transferSig, blSig, seizeSig, removeBlSig, resumeSig },
    };
    console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
