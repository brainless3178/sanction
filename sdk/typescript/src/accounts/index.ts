import { PublicKey } from "@solana/web3.js";

// Ensure this matches the ID declared in Rust
export const SSS_TOKEN_PROGRAM_ID = new PublicKey("2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no");
export const SSS_TRANSFER_HOOK_PROGRAM_ID = new PublicKey("8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ");

export function getConfigPda(mint: PublicKey, programId: PublicKey = SSS_TOKEN_PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("config"), mint.toBuffer()],
        programId
    );
}

export function getRolePda(mint: PublicKey, account: PublicKey, roleId: number, programId: PublicKey = SSS_TOKEN_PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("role"), mint.toBuffer(), account.toBuffer(), Buffer.from([roleId])],
        programId
    );
}

export function getBlacklistPda(mint: PublicKey, target: PublicKey, programId: PublicKey = SSS_TOKEN_PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("blacklist"), mint.toBuffer(), target.toBuffer()],
        programId
    );
}

export function getExtraAccountMetaListPda(mint: PublicKey, programId: PublicKey = SSS_TRANSFER_HOOK_PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("extra-account-metas"), mint.toBuffer()],
        programId
    );
}
