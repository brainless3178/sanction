use anchor_lang::prelude::*;
use processor::*;

pub mod processor;

declare_id!("8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn execute(ctx: Context<ExecuteTransfer>, amount: u64) -> Result<()> {
        processor::execute(ctx, amount)
    }

    pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
        processor::initialize_extra_account_meta_list(ctx)
    }
}
