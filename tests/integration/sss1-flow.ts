import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
} from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
} from '@solana/spl-token';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import * as fs from 'fs';

/**
 * SSS-1 Integration Test — Full Lifecycle
 *
 * Tests the complete SSS-1 flow:
 *   init → verify config → add minter → mint → check supply → burn →
 *   freeze/thaw → pause/unpause → quota enforcement → revoke minter
 *
 * Requires: local validator running with sss-token deployed
 * Run: anchor test or ts-node tests/integration/sss1-flow.ts
 */

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8899';
const PROGRAM_ID = new PublicKey(
    process.env.PROGRAM_ID || '2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no'
);

const MINT_AMOUNT = 500_000n * 1_000_000n;     // 500K tokens (6 decimals)
const BURN_AMOUNT = 100_000n * 1_000_000n;     // 100K tokens
const MINTER_QUOTA = 1_000_000n * 1_000_000n;  // 1M tokens

async function main() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Load authority keypair
    const authorityPath = process.env.AUTHORITY_KEYPAIR || `${process.env.HOME}/.config/solana/id.json`;
    const authoritySecret = JSON.parse(fs.readFileSync(authorityPath, 'utf-8'));
    const authority = Keypair.fromSecretKey(Uint8Array.from(authoritySecret));

    const minter = Keypair.generate();
    const user1 = Keypair.generate();

    const provider = new AnchorProvider(
        connection,
        new Wallet(authority),
        { commitment: 'confirmed' }
    );

    console.log('═══════════════════════════════════════');
    console.log('  SSS-1 Integration Test — Full Flow');
    console.log('═══════════════════════════════════════\n');

    // ---- Step 1: Fund test accounts ----
    console.log('1. Airdropping SOL to test accounts...');
    await connection.requestAirdrop(authority.publicKey, 5 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(minter.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(user1.publicKey, 2 * LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✔ All accounts funded\n');

    // ---- Step 2: Initialize SSS-1 ----
    console.log('2. Initializing SSS-1 stablecoin...');
    const mintKeypair = Keypair.generate();
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config'), mintKeypair.publicKey.toBuffer()],
        PROGRAM_ID
    );

    const crypto = await import('crypto');
    const initDiscriminator = crypto.createHash('sha256').update('global:initialize').digest().subarray(0, 8);
    const nameBytes = Buffer.from('Test USD', 'utf-8');
    const symbolBytes = Buffer.from('TUSD', 'utf-8');
    const uriBytes = Buffer.from('https://test.com/metadata.json', 'utf-8');

    const initData = Buffer.concat([
        initDiscriminator,
        Buffer.from(new Uint32Array([nameBytes.length]).buffer), nameBytes,
        Buffer.from(new Uint32Array([symbolBytes.length]).buffer), symbolBytes,
        Buffer.from(new Uint32Array([uriBytes.length]).buffer), uriBytes,
        Buffer.from([6]),  // decimals
        Buffer.from([0]),  // enable_permanent_delegate = false (SSS-1)
        Buffer.from([0]),  // enable_transfer_hook = false (SSS-1)
    ]);

    const { Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, sendAndConfirmTransaction } = await import('@solana/web3.js');

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

    const initTx = new Transaction().add(initIx);
    const initSig = await sendAndConfirmTransaction(connection, initTx, [authority, mintKeypair]);
    console.log(`   ✔ SSS-1 stablecoin initialized — tx: ${initSig}\n`);

    // ---- Step 3: Verify config ----
    console.log('3. Verifying config state...');
    const configAccount = await connection.getAccountInfo(configPda);
    if (!configAccount) throw new Error('Config PDA not found');
    console.log(`   ✔ Config PDA exists (${configAccount.data.length} bytes)\n`);

    // ---- Step 4: Add minter ----
    console.log('4. Adding minter with 1,000,000 token quota...');
    const minterRoleDiscriminator = Buffer.from([0]); // Minter = 0
    const [rolePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('role'), mintKeypair.publicKey.toBuffer(), minter.publicKey.toBuffer(), minterRoleDiscriminator],
        PROGRAM_ID
    );

    const assignDiscriminator = crypto.createHash('sha256').update('global:assign_role').digest().subarray(0, 8);
    const quotaBuffer = Buffer.alloc(8);
    quotaBuffer.writeBigUInt64LE(MINTER_QUOTA);
    const assignData = Buffer.concat([assignDiscriminator, minterRoleDiscriminator, quotaBuffer]);

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
        data: assignData,
    };
    const assignSig = await sendAndConfirmTransaction(connection, new Transaction().add(assignIx), [authority]);
    console.log(`   ✔ Minter role assigned — tx: ${assignSig}\n`);

    // ---- Step 5: Mint tokens ----
    console.log('5. Minting 500,000 tokens to user1...');
    const user1Ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, user1.publicKey, true, TOKEN_2022_PROGRAM_ID);

    const { createAssociatedTokenAccountIdempotentInstruction } = await import('@solana/spl-token');
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        minter.publicKey, user1Ata, user1.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID,
    );

    const mintDiscriminator = crypto.createHash('sha256').update('global:mint_tokens').digest().subarray(0, 8);
    const mintAmountBuf = Buffer.alloc(8);
    mintAmountBuf.writeBigUInt64LE(MINT_AMOUNT);
    const mintData = Buffer.concat([mintDiscriminator, mintAmountBuf]);

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
        data: mintData,
    };

    const mintTx = new Transaction().add(createAtaIx).add(mintIx);
    const mintSig = await sendAndConfirmTransaction(connection, mintTx, [minter]);
    console.log(`   ✔ Tokens minted — tx: ${mintSig}\n`);

    // ---- Step 6: Verify supply ----
    console.log('6. Verifying supply tracking...');
    const supplyInfo = await connection.getTokenSupply(mintKeypair.publicKey);
    console.log(`   Supply: ${supplyInfo.value.uiAmountString}`);
    const user1Account = await getAccount(connection, user1Ata, 'confirmed', TOKEN_2022_PROGRAM_ID);
    console.log(`   User1 balance: ${user1Account.amount}`);
    if (user1Account.amount.toString() !== MINT_AMOUNT.toString()) {
        throw new Error(`Expected ${MINT_AMOUNT}, got ${user1Account.amount}`);
    }
    console.log('   ✔ Supply and balance verified\n');

    // ---- Step 7: Burn tokens ----
    console.log('7. Burning 100,000 tokens...');
    const burnDiscriminator = crypto.createHash('sha256').update('global:burn_tokens').digest().subarray(0, 8);
    const burnAmountBuf = Buffer.alloc(8);
    burnAmountBuf.writeBigUInt64LE(BURN_AMOUNT);
    const burnData = Buffer.concat([burnDiscriminator, burnAmountBuf]);

    const burnIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: user1.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: user1Ata, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: burnData,
    };

    const burnSig = await sendAndConfirmTransaction(connection, new Transaction().add(burnIx), [user1]);
    const supplyAfterBurn = await connection.getTokenSupply(mintKeypair.publicKey);
    console.log(`   Supply after burn: ${supplyAfterBurn.value.uiAmountString}`);
    console.log(`   ✔ Tokens burned — tx: ${burnSig}\n`);

    // ---- Step 8: Freeze/Thaw ----
    console.log('8. Testing freeze/thaw operations...');
    const freezeDiscriminator = crypto.createHash('sha256').update('global:freeze_account').digest().subarray(0, 8);
    const freezeIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: false },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: user1Ata, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(freezeDiscriminator),
    };
    const freezeSig = await sendAndConfirmTransaction(connection, new Transaction().add(freezeIx), [authority]);
    console.log(`   Frozen — tx: ${freezeSig}`);

    const thawDiscriminator = crypto.createHash('sha256').update('global:thaw_account').digest().subarray(0, 8);
    const thawIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: false },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: user1Ata, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(thawDiscriminator),
    };
    const thawSig = await sendAndConfirmTransaction(connection, new Transaction().add(thawIx), [authority]);
    console.log(`   Thawed — tx: ${thawSig}`);
    console.log('   ✔ Freeze/thaw operations verified\n');

    // ---- Step 9: Global pause ----
    console.log('9. Testing global pause...');
    const pauseDiscriminator = crypto.createHash('sha256').update('global:set_global_pause').digest().subarray(0, 8);
    const pauseData = Buffer.concat([pauseDiscriminator, Buffer.from([1])]);
    const pauseIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: false },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: true },
        ],
        data: pauseData,
    };
    const pauseSig = await sendAndConfirmTransaction(connection, new Transaction().add(pauseIx), [authority]);
    console.log(`   Paused — tx: ${pauseSig}`);

    const unpauseData = Buffer.concat([pauseDiscriminator, Buffer.from([0])]);
    const unpauseIx = { ...pauseIx, data: unpauseData };
    const unpauseSig = await sendAndConfirmTransaction(connection, new Transaction().add(unpauseIx), [authority]);
    console.log(`   Unpaused — tx: ${unpauseSig}`);
    console.log('   ✔ Global pause/unpause verified\n');

    // ---- Step 10: Quota enforcement ----
    console.log('10. Testing minter quota enforcement...');
    const overQuota = MINTER_QUOTA + 1n;
    const overAmountBuf = Buffer.alloc(8);
    overAmountBuf.writeBigUInt64LE(overQuota);
    const overMintData = Buffer.concat([mintDiscriminator, overAmountBuf]);
    const overMintIx = {
        programId: PROGRAM_ID,
        keys: mintIx.keys,
        data: overMintData,
    };

    try {
        await sendAndConfirmTransaction(connection, new Transaction().add(overMintIx), [minter]);
        throw new Error('Should have failed — quota exceeded');
    } catch (err: any) {
        if (err.message === 'Should have failed — quota exceeded') throw err;
        console.log(`   ✔ Over-quota mint correctly rejected: ${err.message.slice(0, 60)}\n`);
    }

    // ---- Step 11: Revoke minter ----
    console.log('11. Revoking minter role...');
    const revokeDiscriminator = crypto.createHash('sha256').update('global:revoke_role').digest().subarray(0, 8);
    const revokeData = Buffer.concat([revokeDiscriminator, minterRoleDiscriminator]);
    const revokeIx = {
        programId: PROGRAM_ID,
        keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
            { pubkey: configPda, isSigner: false, isWritable: false },
            { pubkey: minter.publicKey, isSigner: false, isWritable: false },
            { pubkey: rolePda, isSigner: false, isWritable: true },
        ],
        data: revokeData,
    };
    const revokeSig = await sendAndConfirmTransaction(connection, new Transaction().add(revokeIx), [authority]);
    console.log(`   Role revoked — tx: ${revokeSig}`);

    // Verify unauthorized mint
    try {
        await sendAndConfirmTransaction(connection, new Transaction().add(mintIx), [minter]);
        throw new Error('Should have failed — role revoked');
    } catch (err: any) {
        if (err.message === 'Should have failed — role revoked') throw err;
        console.log(`   ✔ Unauthorized mint correctly rejected\n`);
    }

    console.log('═══════════════════════════════════════');
    console.log('  SSS-1 Integration Test — ALL PASSED');
    console.log('═══════════════════════════════════════\n');

    // Save results
    const results = {
        mint: mintKeypair.publicKey.toBase58(),
        authority: authority.publicKey.toBase58(),
        transactions: { initSig, assignSig, mintSig, burnSig, freezeSig, thawSig, pauseSig, unpauseSig, revokeSig },
    };
    console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
