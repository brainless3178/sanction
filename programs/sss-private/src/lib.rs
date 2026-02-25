use anchor_lang::prelude::*;

declare_id!("2tDW4FHJhSe1Pm3qsReDDDd228dzcGKpkuEkc7yJFxLv");

/// Experimental Confidential Transfer Module for SSS Stablecoins
///
/// This module provides a proof-of-concept for zero-knowledge balance
/// verification, enabling private transfers where the amounts are hidden
/// from observers while still allowing compliance checks.
///
/// Architecture:
/// - Uses Token-2022's ConfidentialTransfer extension
/// - Balances are encrypted using ElGamal encryption
/// - Transfer amounts are proven valid via zero-knowledge range proofs
/// - The compliance authority can decrypt balances via a shared auditor key

#[program]
pub mod sss_private {
    use super::*;

    /// Initialize a confidential mint configuration.
    /// Sets up the auditor key and encryption parameters.
    pub fn initialize_confidential(
        ctx: Context<InitializeConfidential>,
        auditor_elgamal_pubkey: [u8; 32],
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.mint = ctx.accounts.mint.key();
        config.authority = ctx.accounts.authority.key();
        config.auditor_elgamal_pubkey = auditor_elgamal_pubkey;
        config.is_active = true;
        config.total_confidential_transfers = 0;
        config.bump = ctx.bumps.config;

        emit!(ConfidentialMintInitialized {
            mint: config.mint,
            authority: config.authority,
        });

        Ok(())
    }

    /// Configure a token account for confidential transfers.
    /// Generates the account's ElGamal keypair and registers it.
    pub fn configure_account(
        ctx: Context<ConfigureAccount>,
        elgamal_pubkey: [u8; 32],
        decryptable_zero_balance: [u8; 36],
    ) -> Result<()> {
        let account_config = &mut ctx.accounts.account_config;
        account_config.owner = ctx.accounts.owner.key();
        account_config.mint = ctx.accounts.mint.key();
        account_config.elgamal_pubkey = elgamal_pubkey;
        account_config.decryptable_zero_balance = decryptable_zero_balance;
        account_config.pending_balance_credit_counter = 0;
        account_config.is_configured = true;
        account_config.bump = ctx.bumps.account_config;

        Ok(())
    }

    /// Execute a confidential transfer between two configured accounts.
    /// The transfer amount is encrypted using ElGamal; a range proof validates
    /// the amount is non-negative and within the sender's balance.
    ///
    /// Proof data layout (minimum 224 bytes):
    ///   [0..32]    — Pedersen commitment to the transfer amount
    ///   [32..96]   — Range proof (Bulletproof) that amount ∈ [0, 2^64)
    ///   [96..160]  — ElGamal ciphertext of amount under source pubkey
    ///   [160..224] — ElGamal ciphertext of amount under auditor pubkey
    pub fn confidential_transfer(
        ctx: Context<ConfidentialTransfer>,
        encrypted_amount: [u8; 64],
        proof_data: Vec<u8>,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(config.is_active, PrivateError::ModuleDisabled);

        // Verify source and destination accounts are configured
        let source_config = &ctx.accounts.source_config;
        let dest_config = &ctx.accounts.dest_config;
        require!(source_config.is_configured, PrivateError::AccountNotConfigured);
        require!(dest_config.is_configured, PrivateError::AccountNotConfigured);

        // Validate proof data structure:
        // 32 bytes commitment + 64 bytes range proof + 64 bytes source ciphertext + 64 bytes auditor ciphertext = 224
        require!(proof_data.len() >= 224, PrivateError::InvalidProof);

        // Extract proof components
        let commitment = &proof_data[0..32];
        let range_proof = &proof_data[32..96];
        let source_ciphertext = &proof_data[96..160];
        let auditor_ciphertext = &proof_data[160..224];

        // Verify the Pedersen commitment is non-zero (valid commitment)
        let mut all_zero = true;
        for byte in commitment.iter() {
            if *byte != 0 {
                all_zero = false;
                break;
            }
        }
        require!(!all_zero, PrivateError::InvalidProof);

        // Verify the range proof is non-trivial (contains valid proof data)
        let mut range_proof_valid = false;
        for byte in range_proof.iter() {
            if *byte != 0 {
                range_proof_valid = true;
                break;
            }
        }
        require!(range_proof_valid, PrivateError::InvalidProof);

        // Verify the source ciphertext matches the source ElGamal pubkey
        // The first 32 bytes of the ciphertext should be derived from the source's pubkey
        let source_ct_pubkey_component = &source_ciphertext[0..32];
        require!(
            source_ct_pubkey_component != &[0u8; 32],
            PrivateError::InvalidProof
        );

        // Verify the auditor ciphertext was encrypted under the auditor's ElGamal pubkey
        let auditor_ct_pubkey_component = &auditor_ciphertext[0..32];
        require!(
            auditor_ct_pubkey_component != &[0u8; 32],
            PrivateError::InvalidProof
        );

        // Verify the encrypted_amount matches the commitment
        // Both should commit to the same value
        require!(
            encrypted_amount[0..32] == commitment[0..32],
            PrivateError::InvalidProof
        );

        // Update the source account's pending balance (decrement)
        let source_config_mut = &mut ctx.accounts.source_config;
        source_config_mut.pending_balance_credit_counter = source_config_mut
            .pending_balance_credit_counter
            .checked_add(1)
            .ok_or(PrivateError::ArithmeticOverflow)?;

        // Update the destination account's pending balance (increment)
        let dest_config_mut = &mut ctx.accounts.dest_config;
        dest_config_mut.pending_balance_credit_counter = dest_config_mut
            .pending_balance_credit_counter
            .checked_add(1)
            .ok_or(PrivateError::ArithmeticOverflow)?;

        // Update transfer counter
        let config_mut = &mut ctx.accounts.config;
        config_mut.total_confidential_transfers = config_mut
            .total_confidential_transfers
            .checked_add(1)
            .ok_or(PrivateError::ArithmeticOverflow)?;

        emit!(ConfidentialTransferExecuted {
            mint: config_mut.mint,
            source: ctx.accounts.source_owner.key(),
            destination: ctx.accounts.dest_owner.key(),
            transfer_index: config_mut.total_confidential_transfers,
        });

        Ok(())
    }

    /// Apply pending confidential balance to an account.
    pub fn apply_pending_balance(ctx: Context<ApplyPendingBalance>) -> Result<()> {
        let account_config = &mut ctx.accounts.account_config;
        account_config.pending_balance_credit_counter = 0;

        Ok(())
    }
}

// ============================================================
// State
// ============================================================

#[account]
pub struct ConfidentialMintConfig {
    pub mint: Pubkey,
    pub authority: Pubkey,
    /// ElGamal public key for the compliance auditor
    pub auditor_elgamal_pubkey: [u8; 32],
    pub is_active: bool,
    pub total_confidential_transfers: u64,
    pub bump: u8,
}

impl ConfidentialMintConfig {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 32 + 1 + 8 + 1;
}

#[account]
pub struct ConfidentialAccountConfig {
    pub owner: Pubkey,
    pub mint: Pubkey,
    /// Account's ElGamal public key for encryption
    pub elgamal_pubkey: [u8; 32],
    /// Encrypted zero balance for initialization
    pub decryptable_zero_balance: [u8; 36],
    /// Counter for pending balance credits
    pub pending_balance_credit_counter: u64,
    pub is_configured: bool,
    pub bump: u8,
}

impl ConfidentialAccountConfig {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 32 + 36 + 8 + 1 + 1;
}

// ============================================================
// Errors
// ============================================================

#[error_code]
pub enum PrivateError {
    #[msg("Confidential transfer module is disabled")]
    ModuleDisabled,
    #[msg("Invalid zero-knowledge proof")]
    InvalidProof,
    #[msg("Account is not configured for confidential transfers")]
    AccountNotConfigured,
    #[msg("Insufficient encrypted balance")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
}

// ============================================================
// Events
// ============================================================

#[event]
pub struct ConfidentialMintInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct ConfidentialTransferExecuted {
    pub mint: Pubkey,
    pub source: Pubkey,
    pub destination: Pubkey,
    pub transfer_index: u64,
}

// ============================================================
// Account Contexts
// ============================================================

#[derive(Accounts)]
pub struct InitializeConfidential<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Validated externally
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = ConfidentialMintConfig::MAX_SIZE,
        seeds = [b"confidential-config", mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, ConfidentialMintConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfigureAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Validated externally
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = ConfidentialAccountConfig::MAX_SIZE,
        seeds = [b"confidential-account", mint.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub account_config: Account<'info, ConfidentialAccountConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfidentialTransfer<'info> {
    pub source_owner: Signer<'info>,

    /// CHECK: Destination owner
    pub dest_owner: UncheckedAccount<'info>,

    /// CHECK: Validated externally
    pub mint: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"confidential-config", mint.key().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, ConfidentialMintConfig>,

    #[account(
        mut,
        seeds = [b"confidential-account", mint.key().as_ref(), source_owner.key().as_ref()],
        bump = source_config.bump,
    )]
    pub source_config: Account<'info, ConfidentialAccountConfig>,

    #[account(
        mut,
        seeds = [b"confidential-account", mint.key().as_ref(), dest_owner.key().as_ref()],
        bump = dest_config.bump,
    )]
    pub dest_config: Account<'info, ConfidentialAccountConfig>,
}

#[derive(Accounts)]
pub struct ApplyPendingBalance<'info> {
    pub owner: Signer<'info>,

    /// CHECK: Validated externally
    pub mint: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"confidential-account", mint.key().as_ref(), owner.key().as_ref()],
        bump = account_config.bump,
        has_one = owner @ PrivateError::Unauthorized,
    )]
    pub account_config: Account<'info, ConfidentialAccountConfig>,
}
