use anchor_lang::prelude::*;
use sss_token::state::StablecoinConfig;
use sss_token::errors::SssError;
use anchor_spl::token_interface::Mint;

pub fn execute(ctx: Context<ExecuteTransfer>, _amount: u64) -> Result<()> {
    // We check the config PDA
    let config_data = ctx.accounts.config.try_borrow_data()?;
    let config = StablecoinConfig::try_deserialize(&mut config_data.as_ref())?;
    require!(!config.is_paused, SssError::GlobalPause);

    // If source_blacklist has lamports, it's blacklisted
    if ctx.accounts.source_blacklist.lamports() > 0 {
        return Err(SssError::SourceBlacklisted.into());
    }

    // If destination_blacklist has lamports, it's blacklisted
    if ctx.accounts.destination_blacklist.lamports() > 0 {
        return Err(SssError::DestinationBlacklisted.into());
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ExecuteTransfer<'info> {
    /// CHECK: source
    pub source: UncheckedAccount<'info>,
    /// CHECK: mint
    pub mint: UncheckedAccount<'info>,
    /// CHECK: destination
    pub destination: UncheckedAccount<'info>,
    /// CHECK: owner
    pub owner: UncheckedAccount<'info>,
    /// CHECK: extra account meta list
    pub extra_account_meta_list: UncheckedAccount<'info>,
    
    // Extra accounts
    /// CHECK: config
    #[account(
        seeds = [b"config", mint.key().as_ref()],
        seeds::program = sss_token::ID,
        bump,
    )]
    pub config: UncheckedAccount<'info>,

    /// CHECK: source blacklist
    #[account(
        seeds = [b"blacklist", mint.key().as_ref(), source.key().as_ref()],
        seeds::program = sss_token::ID,
        bump,
    )]
    pub source_blacklist: UncheckedAccount<'info>,

    /// CHECK: destination blacklist
    #[account(
        seeds = [b"blacklist", mint.key().as_ref(), destination.key().as_ref()],
        seeds::program = sss_token::ID,
        bump,
    )]
    pub destination_blacklist: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList account PDA
    #[account(
        init,
        space = 8 + 4 + 3 * 35, // 8 bytes discriminator + 4 bytes length + 3 ExtraAccountMetas (35 bytes each)
        payer = payer,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    use spl_tlv_account_resolution::state::ExtraAccountMetaList;
    use spl_tlv_account_resolution::account::ExtraAccountMeta;
    use spl_tlv_account_resolution::seeds::Seed;
    use spl_transfer_hook_interface::instruction::ExecuteInstruction;

    let account_metas = vec![
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal { bytes: b"config".to_vec() },
                Seed::AccountKey { index: 1 }, // mint index is 1
            ],
            false,
            false,
        )?,
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal { bytes: b"blacklist".to_vec() },
                Seed::AccountKey { index: 1 }, // mint index is 1
                Seed::AccountKey { index: 0 }, // source index is 0
            ],
            false,
            false,
        )?,
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal { bytes: b"blacklist".to_vec() },
                Seed::AccountKey { index: 1 }, // mint index is 1
                Seed::AccountKey { index: 2 }, // destination index is 2
            ],
            false,
            false,
        )?,
    ];

    let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(
        &mut data,
        &account_metas,
    )?;

    Ok(())
}
