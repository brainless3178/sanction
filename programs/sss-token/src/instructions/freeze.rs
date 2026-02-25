use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, FreezeAccount, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct FreezeUserAccount<'info> {
    #[account(mut)]
    pub pauser: Signer<'info>,

    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [b"role", mint.key().as_ref(), pauser.key().as_ref(), &[RoleType::Pauser as u8]],
        bump = pauser_role.bump
    )]
    pub pauser_role: Account<'info, RoleAssignment>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub target_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<FreezeUserAccount>) -> Result<()> {
    let pauser_role = &ctx.accounts.pauser_role;
    require!(pauser_role.is_active, SssError::Unauthorized);
    require!(pauser_role.role == RoleType::Pauser, SssError::Unauthorized);

    let mint_key = ctx.accounts.mint.key();
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"config",
        mint_key.as_ref(),
        &[config_bump],
    ]];

    let cpi_accounts = FreezeAccount {
        account: ctx.accounts.target_ata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.config.to_account_info(), // The config PDA is the freeze authority
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    token_2022::freeze_account(cpi_ctx)?;

    let now = Clock::get()?.unix_timestamp;
    emit!(AccountFrozen {
        mint: ctx.accounts.config.mint,
        target: ctx.accounts.target_ata.owner,
        frozen_by: ctx.accounts.pauser.key(),
        timestamp: now,
    });

    Ok(())
}
