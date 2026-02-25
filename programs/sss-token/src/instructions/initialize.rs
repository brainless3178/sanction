use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_2022::{self, Token2022};
use anchor_spl::token_2022::spl_token_2022;
use anchor_spl::token_2022::spl_token_2022::extension::ExtensionType;

use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = StablecoinConfig::space(),
        seeds = [b"config", mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, StablecoinConfig>,

    // Discriminator: 8, Mint: 32, Account: 32, Role: 1, Quota: 8, Minted: 8, Period: 8, Active: 1, Bump: 1 => 99 bytes
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 1, 
        seeds = [b"role", mint.key().as_ref(), authority.key().as_ref(), &[0]], // 0 corresponds to RoleType::Minter as u8
        bump
    )]
    pub master_minter_role: Account<'info, RoleAssignment>,

    #[account(mut)]
    /// CHECK: Mint account is manually constructed with dynamic extensions
    pub mint: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    // 1. Validate params
    require!(params.name.len() <= StablecoinConfig::MAX_NAME_LEN, SssError::NameTooLong);
    require!(params.symbol.len() <= StablecoinConfig::MAX_SYMBOL_LEN, SssError::SymbolTooLong);
    require!(params.decimals <= 9, SssError::InvalidDecimals);

    // 2. Build Token-2022 mint extensions list based on feature flags
    let mut extension_types = vec![];
    extension_types.push(ExtensionType::MetadataPointer);

    if params.enable_permanent_delegate {
        extension_types.push(ExtensionType::PermanentDelegate);
    }
    if params.enable_transfer_hook {
        extension_types.push(ExtensionType::TransferHook);
    }
    if params.default_account_frozen {
        extension_types.push(ExtensionType::DefaultAccountState);
    }
    extension_types.push(ExtensionType::MintCloseAuthority);

    // Calculate space required for mint
    let mint_space = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(&extension_types).unwrap();
    // Allocate extra space for metadata (name + symbol + uri + generic TLV envelope)
    // Approximate metadata space: max 32 + max 10 + max 200 + ~100 bytes for TLV headers
    let metadata_space = 400; 
    let total_space = mint_space + metadata_space;

    // Create Mint Account manually
    let lamports = Rent::get()?.minimum_balance(total_space);
    system_program::create_account(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.mint.to_account_info(),
            },
        ),
        lamports,
        total_space as u64,
        ctx.accounts.token_program.key,
    )?;

    // 3. Initialize selected extensions via CPI
    // Metadata pointer first
    anchor_lang::solana_program::program::invoke(
        &spl_token_2022::extension::metadata_pointer::instruction::initialize(
            ctx.accounts.token_program.key,
            ctx.accounts.mint.key,
            Some(ctx.accounts.config.key()), // Metadata pointer authority is config
            Some(ctx.accounts.mint.key()), // Mint acts as its own metadata account
        )?,
        &[ctx.accounts.mint.to_account_info()],
    )?;

    if params.enable_permanent_delegate {
        anchor_lang::solana_program::program::invoke(
            &spl_token_2022::instruction::initialize_permanent_delegate(
                ctx.accounts.token_program.key,
                ctx.accounts.mint.key,
                &ctx.accounts.config.key(), // The config PDA acts as the permanent delegate
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    if params.enable_transfer_hook {
        // Transfer hook program: 8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ
        let transfer_hook_program_id = std::str::FromStr::from_str("8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ").unwrap();
        anchor_lang::solana_program::program::invoke(
            &spl_token_2022::extension::transfer_hook::instruction::initialize(
                ctx.accounts.token_program.key,
                ctx.accounts.mint.key,
                Some(ctx.accounts.config.key()), // Transfer hook update authority is config
                Some(transfer_hook_program_id), // SSS Transfer Hook program
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    if params.default_account_frozen {
        anchor_lang::solana_program::program::invoke(
            &spl_token_2022::extension::default_account_state::instruction::initialize_default_account_state(
                ctx.accounts.token_program.key,
                ctx.accounts.mint.key,
                &spl_token_2022::state::AccountState::Frozen,
            )?,
            &[ctx.accounts.mint.to_account_info()],
        )?;
    }

    anchor_lang::solana_program::program::invoke(
        &spl_token_2022::instruction::initialize_mint_close_authority(
            ctx.accounts.token_program.key,
            ctx.accounts.mint.key,
            Some(&ctx.accounts.config.key()), // The config PDA acts as the mint close authority
        )?,
        &[ctx.accounts.mint.to_account_info()],
    )?;

    // Initialize Mint
    anchor_lang::solana_program::program::invoke(
        &spl_token_2022::instruction::initialize_mint(
            ctx.accounts.token_program.key,
            ctx.accounts.mint.key,
            &ctx.accounts.config.key(), // Mint authority is config PDA
            Some(&ctx.accounts.config.key()), // Freeze authority is config PDA
            params.decimals,
        )?,
        &[ctx.accounts.mint.to_account_info(), ctx.accounts.rent.to_account_info()],
    )?;

    // 4. Initialize metadata via CPI
    anchor_lang::solana_program::program::invoke(
        &spl_token_metadata_interface::instruction::initialize(
            &spl_token_2022::id(),
            ctx.accounts.mint.key,
            &ctx.accounts.config.key(), // metadata update authority PDA
            ctx.accounts.mint.key,
            &ctx.accounts.config.key(), // mint authority PDA
            params.name.clone(),
            params.symbol.clone(),
            params.uri.clone(),
        ),
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
    )?;
    
    // 5. Write StablecoinConfig PDA
    let config = &mut ctx.accounts.config;
    config.mint = ctx.accounts.mint.key();
    config.name = params.name.clone();
    config.symbol = params.symbol.clone();
    config.uri = params.uri.clone();
    config.decimals = params.decimals;
    config.enable_permanent_delegate = params.enable_permanent_delegate;
    config.enable_transfer_hook = params.enable_transfer_hook;
    config.default_account_frozen = params.default_account_frozen;
    config.is_paused = false;
    config.total_minted = 0;
    config.total_burned = 0;
    config.master_authority = ctx.accounts.authority.key();
    config.pending_authority = None;
    config.authority_transfer_initiated_at = None;
    config.bump = ctx.bumps.config;

    // 6. Assign master authority its own Minter role with unlimited quota
    let master_minter = &mut ctx.accounts.master_minter_role;
    master_minter.mint = ctx.accounts.mint.key();
    master_minter.account = ctx.accounts.authority.key();
    master_minter.role = RoleType::Minter;
    master_minter.quota = 0; // Unlimited
    master_minter.minted_this_period = 0;
    master_minter.period_start = Clock::get()?.unix_timestamp;
    master_minter.is_active = true;
    master_minter.bump = ctx.bumps.master_minter_role;

    // 7. Emit event
    let preset = match (params.enable_permanent_delegate, params.enable_transfer_hook) {
        (false, false) => "SSS-1".to_string(),
        (true, true) => "SSS-2".to_string(),
        _ => "CUSTOM".to_string(),
    };
    emit!(StablecoinInitialized {
        mint: config.mint,
        name: config.name.clone(),
        symbol: config.symbol.clone(),
        master_authority: config.master_authority,
        preset,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
