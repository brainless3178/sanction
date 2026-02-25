use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [b"role", mint.key().as_ref(), blacklister.key().as_ref(), &[RoleType::Blacklister as u8]],
        bump = blacklister_role.bump
    )]
    pub blacklister_role: Account<'info, RoleAssignment>,

    #[account(
        init,
        payer = blacklister,
        space = 8 + 32 + 32 + (4 + 128) + 32 + 8 + 1,
        seeds = [b"blacklist", mint.key().as_ref(), target_account.key().as_ref()],
        bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    /// CHECK: Target to be blacklisted
    pub target_account: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
    // Check feature flag
    let config = &ctx.accounts.config;
    require!(config.enable_transfer_hook, SssError::ComplianceNotEnabled);

    // Validate role
    let role = &ctx.accounts.blacklister_role;
    require!(role.is_active && role.role == RoleType::Blacklister, SssError::Unauthorized);

    // Validate reason length (max 128 characters)
    require!(reason.len() <= BlacklistEntry::MAX_REASON_LEN, SssError::Overflow); // Using overflow, though maybe should have a dedicated error

    let blacklist_entry = &mut ctx.accounts.blacklist_entry;
    blacklist_entry.mint = ctx.accounts.mint.key();
    blacklist_entry.target = ctx.accounts.target_account.key();
    blacklist_entry.reason = reason.clone();
    blacklist_entry.added_by = ctx.accounts.blacklister.key();
    
    let now = Clock::get()?.unix_timestamp;
    blacklist_entry.added_at = now;
    blacklist_entry.bump = ctx.bumps.blacklist_entry;

    emit!(AddedToBlacklist {
        mint: ctx.accounts.config.mint,
        target: ctx.accounts.target_account.key(),
        reason,
        by: ctx.accounts.blacklister.key(),
        timestamp: now,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [b"role", mint.key().as_ref(), blacklister.key().as_ref(), &[RoleType::Blacklister as u8]],
        bump = blacklister_role.bump
    )]
    pub blacklister_role: Account<'info, RoleAssignment>,

    #[account(
        mut,
        seeds = [b"blacklist", mint.key().as_ref(), target_account.key().as_ref()],
        bump = blacklist_entry.bump,
        close = blacklister
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    /// CHECK: Target to be removed from blacklist
    pub target_account: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
}

pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
    // Check feature flag
    let config = &ctx.accounts.config;
    require!(config.enable_transfer_hook, SssError::ComplianceNotEnabled);

    // Validate role
    let role = &ctx.accounts.blacklister_role;
    require!(role.is_active && role.role == RoleType::Blacklister, SssError::Unauthorized);

    let now = Clock::get()?.unix_timestamp;

    emit!(RemovedFromBlacklist {
        mint: ctx.accounts.config.mint,
        target: ctx.accounts.target_account.key(),
        by: ctx.accounts.blacklister.key(),
        timestamp: now,
    });

    Ok(())
}
