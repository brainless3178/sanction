use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    pub mint: InterfaceAccount<'info, Mint>,
}

pub fn handler(ctx: Context<SetPause>, is_paused: bool) -> Result<()> {
    let config = &mut ctx.accounts.config;
    
    require!(
        ctx.accounts.authority.key() == config.master_authority,
        SssError::MasterAuthorityRequired
    );

    config.is_paused = is_paused;

    let now = Clock::get()?.unix_timestamp;
    emit!(GlobalPauseSet {
        mint: config.mint,
        paused: is_paused,
        by: ctx.accounts.authority.key(),
        timestamp: now,
    });

    Ok(())
}
