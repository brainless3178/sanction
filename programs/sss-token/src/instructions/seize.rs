use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, TransferChecked, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct Seize<'info> {
    #[account(mut)]
    pub seizer: Signer<'info>,

    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [b"role", mint.key().as_ref(), seizer.key().as_ref(), &[RoleType::Seizer as u8]],
        bump = seizer_role.bump
    )]
    pub seizer_role: Account<'info, RoleAssignment>,

    #[account(mut)]
    pub source_ata: InterfaceAccount<'info, TokenAccount>,
    
    #[account(mut)]
    pub destination_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<Seize>, amount: Option<u64>) -> Result<()> {
    // 1. Check compliance enabled
    require!(
        ctx.accounts.config.enable_permanent_delegate,
        SssError::PermanentDelegateNotEnabled
    );

    // 2. Check seizer role
    let role = &ctx.accounts.seizer_role;
    require!(role.is_active && role.role == RoleType::Seizer, SssError::Unauthorized);

    // 3. Get source balance (seize all if amount is None)
    let seize_amount = match amount {
        Some(a) => a,
        None => ctx.accounts.source_ata.amount,
    };
    require!(seize_amount > 0, SssError::ZeroAmount);

    // 4. CPI to Token-2022 transfer using permanent delegate authority
    let mint_key = ctx.accounts.mint.key();
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"config",
        mint_key.as_ref(),
        &[config_bump],
    ]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.source_ata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.destination_ata.to_account_info(),
        authority: ctx.accounts.config.to_account_info(), // permanent_delegate is the config PDA
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    token_2022::transfer_checked(cpi_ctx, seize_amount, ctx.accounts.mint.decimals)?;

    // 5. Emit
    emit!(FundsSeized {
        mint: ctx.accounts.config.mint,
        source: ctx.accounts.source_ata.owner,
        destination: ctx.accounts.destination_ata.owner,
        amount: seize_amount,
        seizer: ctx.accounts.seizer.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
