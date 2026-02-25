use anchor_lang::prelude::*;

#[account]
pub struct StablecoinConfig {
    // Identity
    pub mint: Pubkey,
    pub name: String,                    // max 32 chars
    pub symbol: String,                  // max 10 chars
    pub uri: String,                     // max 200 chars
    pub decimals: u8,
    
    // Feature flags - set once at initialize, immutable after
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    
    // State
    pub is_paused: bool,
    pub total_minted: u64,               // cumulative, never decreases
    pub total_burned: u64,
    
    // Authority
    pub master_authority: Pubkey,
    pub pending_authority: Option<Pubkey>,    // for timelock transfer
    pub authority_transfer_initiated_at: Option<i64>,  // unix timestamp
    
    // Bump for PDA validation
    pub bump: u8,
}

impl StablecoinConfig {
    pub const AUTHORITY_TRANSFER_DELAY: i64 = 86400; // 24 hour timelock
    pub const MAX_NAME_LEN: usize = 32;
    pub const MAX_SYMBOL_LEN: usize = 10;
    pub const MAX_URI_LEN: usize = 200;
    
    pub fn space() -> usize {
        8 + 32 + 4 + Self::MAX_NAME_LEN + 4 + Self::MAX_SYMBOL_LEN 
        + 4 + Self::MAX_URI_LEN + 1 + 1 + 1 + 1 + 1 + 8 + 8 
        + 32 + 1 + 32 + 1 + 8 + 1
    }
}
