import { PublicKey } from "@solana/web3.js";

export interface MintEvent {
    mint: PublicKey;
    recipient: PublicKey;
    amount: bigint;
    minter: PublicKey;
    newSupply: bigint;
    timestamp: bigint;
}

export interface FreezeEvent {
    mint: PublicKey;
    account: PublicKey;
    action: 'Frozen' | 'Thawed';
    by: PublicKey;
    timestamp: bigint;
}

export interface BlacklistEvent {
    mint: PublicKey;
    account: PublicKey;
    action: 'Added' | 'Removed';
    reason?: string;
    by: PublicKey;
    timestamp: bigint;
}
