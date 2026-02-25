use anchor_lang::prelude::*;

#[event]
pub struct StablecoinInitialized {
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub master_authority: Pubkey,
    pub preset: String,          // "SSS-1", "SSS-2", or "CUSTOM"
    pub timestamp: i64,
}

#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub minter: Pubkey,
    pub new_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub amount: u64,
    pub burner: Pubkey,
    pub new_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct AccountFrozen {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub frozen_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AccountThawed {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub thawed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct GlobalPauseSet {
    pub mint: Pubkey,
    pub paused: bool,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleAssigned {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub role: String,
    pub quota: u64,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleRevoked {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub role: String,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AddedToBlacklist {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub reason: String,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RemovedFromBlacklist {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct FundsSeized {
    pub mint: Pubkey,
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub seizer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityTransferInitiated {
    pub mint: Pubkey,
    pub current: Pubkey,
    pub pending: Pubkey,
    pub unlocks_at: i64,         // timestamp when accept can be called
    pub timestamp: i64,
}

#[event]
pub struct AuthorityTransferCompleted {
    pub mint: Pubkey,
    pub previous: Pubkey,
    pub new: Pubkey,
    pub timestamp: i64,
}
