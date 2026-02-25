use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod errors;
pub mod events;

declare_id!("2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no");

use instructions::*;

#[program]
pub mod sss_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    pub fn mint(ctx: Context<MintToUser>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }

    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }

    pub fn freeze(ctx: Context<FreezeUserAccount>) -> Result<()> {
        instructions::freeze::handler(ctx)
    }

    pub fn thaw(ctx: Context<ThawUserAccount>) -> Result<()> {
        instructions::thaw::handler(ctx)
    }

    pub fn set_pause(ctx: Context<SetPause>, is_paused: bool) -> Result<()> {
        instructions::pause::handler(ctx, is_paused)
    }

    pub fn assign_role(ctx: Context<AssignRole>, role: u8, quota: u64) -> Result<()> {
        instructions::roles::assign_role(ctx, role, quota)
    }

    pub fn revoke_role(ctx: Context<RevokeRole>, role: u8) -> Result<()> {
        instructions::roles::revoke_role(ctx, role)
    }

    pub fn add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
        instructions::blacklist::add_to_blacklist(ctx, reason)
    }

    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        instructions::blacklist::remove_from_blacklist(ctx)
    }

    pub fn seize(ctx: Context<Seize>, amount: Option<u64>) -> Result<()> {
        instructions::seize::handler(ctx, amount)
    }

    pub fn initiate_transfer_authority(ctx: Context<InitiateTransferAuthority>) -> Result<()> {
        instructions::transfer_authority::initiate_transfer_authority(ctx)
    }

    pub fn accept_transfer_authority(ctx: Context<AcceptTransferAuthority>) -> Result<()> {
        instructions::transfer_authority::accept_transfer_authority(ctx)
    }

    pub fn cancel_transfer_authority(ctx: Context<CancelTransferAuthority>) -> Result<()> {
        instructions::transfer_authority::cancel_transfer_authority(ctx)
    }
}
