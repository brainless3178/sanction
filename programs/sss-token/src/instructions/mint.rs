use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, MintTo, Token2022};
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct MintToUser<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        seeds = [b"role", mint.key().as_ref(), minter.key().as_ref(), &[RoleType::Minter as u8]],
        bump = minter_role.bump
    )]
    pub minter_role: Account<'info, RoleAssignment>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    /// CHECK: Token ATA of recipient
    pub recipient_ata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<MintToUser>, amount: u64) -> Result<()> {
    // 1. Validate amount > 0
    require!(amount > 0, SssError::ZeroAmount);
    
    // 2. Check global pause
    let config = &ctx.accounts.config;
    require!(!config.is_paused, SssError::GlobalPause);
    
    // 3. Check minter role and quota
    let role = &mut ctx.accounts.minter_role;
    require!(role.is_active, SssError::Unauthorized);
    require!(role.role == RoleType::Minter, SssError::Unauthorized);
    
    // Reset quota if period elapsed
    let now = Clock::get()?.unix_timestamp;
    if now - role.period_start > RoleAssignment::QUOTA_PERIOD {
        role.minted_this_period = 0;
        role.period_start = now;
    }
    
    // Enforce quota on-chain
    require!(role.can_mint(amount), SssError::QuotaExceeded);
    
    // 4. CPI to Token-2022 mint_to
    let mint_key = ctx.accounts.mint.key();
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"config",
        mint_key.as_ref(),
        &[config_bump],
    ]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.recipient_ata.to_account_info(),
        authority: ctx.accounts.config.to_account_info(), // The config PDA is the mint authority
    };
    
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    token_2022::mint_to(cpi_ctx, amount)?;

    // 5. Update state
    role.minted_this_period = role.minted_this_period
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;
    
    let config = &mut ctx.accounts.config;
    config.total_minted = config.total_minted
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;
    
    // 6. Emit event
    emit!(TokensMinted {
        mint: config.mint,
        recipient: ctx.accounts.recipient_ata.key(),
        amount,
        minter: ctx.accounts.minter.key(),
        new_supply: config.total_minted.checked_sub(config.total_burned).ok_or(SssError::Overflow)?,
        timestamp: now,
    });
    
    Ok(())
}
