use anchor_lang::prelude::*;

use crate::state::*;
use crate::errors::*;
use crate::events::*;

/// Step 1: Current authority initiates transfer to a new authority.
/// The transfer is not effective until 24 hours have passed (timelock).
#[derive(Accounts)]
pub struct InitiateTransferAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config", config.mint.as_ref()],
        bump = config.bump,
        constraint = config.master_authority == authority.key() @ SssError::MasterAuthorityRequired,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: The proposed new authority — no constraints needed, any valid pubkey
    pub new_authority: UncheckedAccount<'info>,
}

pub fn initiate_transfer_authority(ctx: Context<InitiateTransferAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let now = Clock::get()?.unix_timestamp;

    config.pending_authority = Some(ctx.accounts.new_authority.key());
    config.authority_transfer_initiated_at = Some(now);

    emit!(AuthorityTransferInitiated {
        mint: config.mint,
        current: config.master_authority,
        pending: ctx.accounts.new_authority.key(),
        unlocks_at: now + StablecoinConfig::AUTHORITY_TRANSFER_DELAY,
        timestamp: now,
    });

    Ok(())
}

/// Step 2: New authority accepts the transfer after timelock has elapsed.
#[derive(Accounts)]
pub struct AcceptTransferAuthority<'info> {
    #[account(mut)]
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config", config.mint.as_ref()],
        bump = config.bump,
        constraint = config.pending_authority == Some(new_authority.key()) @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn accept_transfer_authority(ctx: Context<AcceptTransferAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let now = Clock::get()?.unix_timestamp;

    // Verify timelock has elapsed
    let initiated_at = config.authority_transfer_initiated_at
        .ok_or(SssError::AuthorityTransferNotReady)?;
    require!(
        now >= initiated_at + StablecoinConfig::AUTHORITY_TRANSFER_DELAY,
        SssError::AuthorityTransferNotReady
    );

    let previous = config.master_authority;
    config.master_authority = ctx.accounts.new_authority.key();
    config.pending_authority = None;
    config.authority_transfer_initiated_at = None;

    emit!(AuthorityTransferCompleted {
        mint: config.mint,
        previous,
        new: ctx.accounts.new_authority.key(),
        timestamp: now,
    });

    Ok(())
}

/// Cancel a pending authority transfer (only current authority can cancel).
#[derive(Accounts)]
pub struct CancelTransferAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config", config.mint.as_ref()],
        bump = config.bump,
        constraint = config.master_authority == authority.key() @ SssError::MasterAuthorityRequired,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn cancel_transfer_authority(ctx: Context<CancelTransferAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(config.pending_authority.is_some(), SssError::AuthorityTransferNotReady);

    config.pending_authority = None;
    config.authority_transfer_initiated_at = None;

    Ok(())
}
