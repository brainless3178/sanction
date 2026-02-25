use anchor_lang::prelude::*;

#[account]
pub struct BlacklistEntry {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub reason: String,          // max 128 chars
    pub added_by: Pubkey,        // who blacklisted this address
    pub added_at: i64,           // unix timestamp
    pub bump: u8,
}

impl BlacklistEntry {
    pub const MAX_REASON_LEN: usize = 128;
}
