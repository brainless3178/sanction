import { PublicKey, Keypair } from "@solana/web3.js";

// -- Presets --
export type Preset = 'SSS_1' | 'SSS_2';

// -- Parameters Models --
export interface CreateParams {
    preset?: Preset;
    name: string;
    symbol: string;
    decimals: number;
    uri?: string;
    authority: Keypair;
    // Custom config — used when preset is not set
    extensions?: {
        permanentDelegate?: boolean;
        transferHook?: boolean;
        defaultAccountFrozen?: boolean;
    };
}

export interface MintParams {
    recipient: PublicKey;
    amount: bigint;
    minter: Keypair;
}

export interface BurnParams {
    amount: bigint;
    burner: Keypair;
}

export interface RoleAssignmentParams {
    targetAccount: PublicKey;
    role: RoleType;
    quota: bigint;
    masterAuthority: Keypair;
}

export interface RevokeRoleParams {
    targetAccount: PublicKey;
    role: RoleType;
    masterAuthority: Keypair;
}

export interface PauseParams {
    isPaused: boolean;
    authority: Keypair;
}

export interface BlacklistParams {
    targetAccount: PublicKey;
    reason: string;
    blacklister: Keypair;
}

// -- State Models --
export enum RoleType {
    Minter = 0,
    Burner = 1,
    Blacklister = 2,
    Pauser = 3,
    Seizer = 4,
}

export interface StablecoinConfig {
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    decimals: number;
    enablePermanentDelegate: boolean;
    enableTransferHook: boolean;
    defaultAccountFrozen: boolean;
    isPaused: boolean;
    totalMinted: bigint;
    totalBurned: bigint;
    masterAuthority: PublicKey;
    pendingAuthority: PublicKey | null;
    authorityTransferInitiatedAt: bigint | null;
    bump: number;
}

export interface RoleAssignment {
    mint: PublicKey;
    account: PublicKey;
    role: RoleType;
    quota: bigint;
    mintedThisPeriod: bigint;
    periodStart: bigint;
    isActive: boolean;
    bump: number;
}

export interface BlacklistEntry {
    mint: PublicKey;
    target: PublicKey;
    reason: string;
    addedBy: PublicKey;
    addedAt: bigint;
    bump: number;
}

export interface SupplyInfo {
    totalMinted: bigint;
    totalBurned: bigint;
    circulating: bigint;
    decimals: number;
}

export interface AuditLogFilter {
    action?: 'mint' | 'burn' | 'freeze' | 'blacklist' | 'seize';
    address?: PublicKey;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}

export * from "./events";
