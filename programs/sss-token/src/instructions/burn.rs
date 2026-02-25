use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Burn, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [b"role", mint.key().as_ref(), burner.key().as_ref(), &[RoleType::Burner as u8]],
        bump = burner_role.bump
    )]
    pub burner_role: Account<'info, RoleAssignment>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub burner_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::ZeroAmount);
    
    let config = &ctx.accounts.config;
    require!(!config.is_paused, SssError::GlobalPause);
    
    let burner_role = &ctx.accounts.burner_role;
    require!(burner_role.is_active, SssError::Unauthorized);
    require!(burner_role.role == RoleType::Burner, SssError::Unauthorized);
    
    let cpi_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.burner_ata.to_account_info(),
        authority: ctx.accounts.burner.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );

    token_2022::burn(cpi_ctx, amount)?;

    let config = &mut ctx.accounts.config;
    config.total_burned = config.total_burned
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;
    
    let now = Clock::get()?.unix_timestamp;
    emit!(TokensBurned {
        mint: config.mint,
        amount,
        burner: ctx.accounts.burner.key(),
        new_supply: config.total_minted.checked_sub(config.total_burned).ok_or(SssError::Overflow)?,
        timestamp: now,
    });
    
    Ok(())
}
