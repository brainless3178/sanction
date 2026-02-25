use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct AssignRole<'info> {
    #[account(mut)]
    pub master_authority: Signer<'info>,

    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    // Discriminator: 8, Mint: 32, Account: 32, Role: 1, Quota: 8, Minted: 8, Period: 8, Active: 1, Bump: 1 => 99 bytes
    #[account(
        init_if_needed,
        payer = master_authority,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 1, 
        seeds = [b"role", mint.key().as_ref(), target_account.key().as_ref(), &[role]],
        bump
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    /// CHECK: Target account receiving the role
    pub target_account: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn assign_role(ctx: Context<AssignRole>, role: u8, quota: u64) -> Result<()> {
    require!(ctx.accounts.master_authority.key() == ctx.accounts.config.master_authority, SssError::MasterAuthorityRequired);

    let parsed_role = match role {
        0 => RoleType::Minter,
        1 => RoleType::Burner,
        2 => RoleType::Blacklister,
        3 => RoleType::Pauser,
        4 => RoleType::Seizer,
        _ => return Err(ProgramError::InvalidArgument.into()),
    };

    let role_assignment = &mut ctx.accounts.role_assignment;
    role_assignment.mint = ctx.accounts.mint.key();
    role_assignment.account = ctx.accounts.target_account.key();
    role_assignment.role = parsed_role.clone();
    role_assignment.quota = quota;
    
    // Do not reset minted quota if the role account already exists and was active,
    // to prevent gaming the daily quota limits.
    if !role_assignment.is_active {
        role_assignment.minted_this_period = 0;
        role_assignment.period_start = Clock::get()?.unix_timestamp;
    }

    role_assignment.is_active = true;
    role_assignment.bump = ctx.bumps.role_assignment;

    let role_str = match parsed_role {
        RoleType::Minter => "Minter",
        RoleType::Burner => "Burner",
        RoleType::Blacklister => "Blacklister",
        RoleType::Pauser => "Pauser",
        RoleType::Seizer => "Seizer",
    }.to_string();

    let now = Clock::get()?.unix_timestamp;
    emit!(RoleAssigned {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.target_account.key(),
        role: role_str,
        quota,
        by: ctx.accounts.master_authority.key(),
        timestamp: now,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct RevokeRole<'info> {
    #[account(mut)]
    pub master_authority: Signer<'info>,

    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        mut,
        seeds = [b"role", mint.key().as_ref(), target_account.key().as_ref(), &[role]],
        bump = role_assignment.bump,
        close = master_authority
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    /// CHECK: Target account losing the role
    pub target_account: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
}

pub fn revoke_role(ctx: Context<RevokeRole>, role: u8) -> Result<()> {
    require!(ctx.accounts.master_authority.key() == ctx.accounts.config.master_authority, SssError::MasterAuthorityRequired);

    let parsed_role = match role {
        0 => RoleType::Minter,
        1 => RoleType::Burner,
        2 => RoleType::Blacklister,
        3 => RoleType::Pauser,
        4 => RoleType::Seizer,
        _ => return Err(ProgramError::InvalidArgument.into()),
    };

    let role_str = match parsed_role {
        RoleType::Minter => "Minter",
        RoleType::Burner => "Burner",
        RoleType::Blacklister => "Blacklister",
        RoleType::Pauser => "Pauser",
        RoleType::Seizer => "Seizer",
    }.to_string();

    let now = Clock::get()?.unix_timestamp;
    emit!(RoleRevoked {
        mint: ctx.accounts.mint.key(),
        account: ctx.accounts.target_account.key(),
        role: role_str,
        by: ctx.accounts.master_authority.key(),
        timestamp: now,
    });

    Ok(())
}
