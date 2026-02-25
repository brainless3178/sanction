use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RoleType {
    Minter,
    Burner,
    Blacklister,   // SSS-2 only
    Pauser,
    Seizer,        // SSS-2 only
}

#[account]
pub struct RoleAssignment {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub role: RoleType,
    pub quota: u64,             // only meaningful for Minter; 0 = unlimited
    pub minted_this_period: u64,
    pub period_start: i64,      // unix timestamp
    pub is_active: bool,
    pub bump: u8,
}

impl RoleAssignment {
    pub const QUOTA_PERIOD: i64 = 86400; // 24 hours
    
    pub fn can_mint(&self, amount: u64) -> bool {
        if !self.is_active { return false; }
        if self.quota == 0 { return true; }
        self.minted_this_period.checked_add(amount)
            .map(|total| total <= self.quota)
            .unwrap_or(false)
    }
}
