use anchor_lang::prelude::*;

/// Maximum currency string length (e.g., "EUR", "BRL", "CPI")
const MAX_CURRENCY_LEN: usize = 16;

/// Price precision: 6 decimals (1.00 USD = 1_000_000)
const PRICE_PRECISION: u64 = 1_000_000;

/// Offset within the Switchboard V2 AggregatorAccountData where the latest
/// confirmed round result is stored (mantissa as i128 at this offset).
const SWITCHBOARD_RESULT_OFFSET: usize = 208;

/// Scale factor for Switchboard mantissa → our u64 precision.
const SWITCHBOARD_DECIMALS: i32 = 18;

// ============================================================
// State
// ============================================================

#[account]
pub struct PriceFeed {
    /// The stablecoin mint this feed tracks
    pub mint: Pubkey,
    /// The Switchboard aggregator account
    pub switchboard_feed: Pubkey,
    /// Currency code (e.g., "EUR", "BRL", "CPI")
    pub currency: String,
    /// Last fetched price (6 decimal precision)
    pub last_price: u64,
    /// Unix timestamp of last update
    pub last_updated: i64,
    /// Reject prices older than this many seconds
    pub staleness_threshold: i64,
    /// Authority that registered this feed
    pub authority: Pubkey,
    /// PDA bump
    pub bump: u8,
}

impl PriceFeed {
    pub const MAX_SIZE: usize = 8  // discriminator
        + 32                       // mint
        + 32                       // switchboard_feed
        + 4 + MAX_CURRENCY_LEN     // currency (String: 4 byte len + chars)
        + 8                        // last_price
        + 8                        // last_updated
        + 8                        // staleness_threshold
        + 32                       // authority
        + 1;                       // bump
}

// ============================================================
// Errors
// ============================================================

#[error_code]
pub enum OracleError {
    #[msg("Price feed is stale — exceeds staleness threshold")]
    StalePriceFeed,
    #[msg("Price is zero or negative — invalid aggregator data")]
    InvalidPrice,
    #[msg("Currency string exceeds maximum length")]
    CurrencyTooLong,
    #[msg("Switchboard account is invalid or not readable")]
    InvalidSwitchboardAccount,
    #[msg("Arithmetic overflow in price calculation")]
    ArithmeticOverflow,
    #[msg("Unauthorized — only the feed authority can update")]
    Unauthorized,
    #[msg("Switchboard account data too short")]
    InsufficientAggregatorData,
}

// ============================================================
// Register Feed
// ============================================================

#[derive(Accounts)]
#[instruction(currency: String)]
pub struct RegisterFeed<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: The Switchboard aggregator account — validated by reading its data in get_price
    pub switchboard_feed: UncheckedAccount<'info>,

    /// CHECK: The stablecoin mint — validated by PDA seeds
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = PriceFeed::MAX_SIZE,
        seeds = [b"price-feed", mint.key().as_ref(), currency.as_bytes()],
        bump
    )]
    pub price_feed: Account<'info, PriceFeed>,

    pub system_program: Program<'info, System>,
}

pub fn register_feed(
    ctx: Context<RegisterFeed>,
    currency: String,
    staleness_threshold: i64,
) -> Result<()> {
    require!(currency.len() <= MAX_CURRENCY_LEN, OracleError::CurrencyTooLong);
    require!(staleness_threshold > 0, OracleError::InvalidPrice);

    let feed = &mut ctx.accounts.price_feed;
    feed.mint = ctx.accounts.mint.key();
    feed.switchboard_feed = ctx.accounts.switchboard_feed.key();
    feed.currency = currency;
    feed.last_price = 0;
    feed.last_updated = 0;
    feed.staleness_threshold = staleness_threshold;
    feed.authority = ctx.accounts.authority.key();
    feed.bump = ctx.bumps.price_feed;

    Ok(())
}

// ============================================================
// Get Price
// ============================================================

#[derive(Accounts)]
pub struct GetPrice<'info> {
    /// CHECK: Switchboard aggregator — validated by has_one constraint
    pub switchboard_feed: UncheckedAccount<'info>,

    #[account(
        mut,
        has_one = switchboard_feed @ OracleError::InvalidSwitchboardAccount,
    )]
    pub price_feed: Account<'info, PriceFeed>,
}

/// Read the latest price from the Switchboard V2 aggregator account.
///
/// The Switchboard V2 AggregatorAccountData stores the latest confirmed round
/// result as an i128 mantissa at a known offset. We read the raw bytes,
/// convert from Switchboard's 18-decimal precision to our 6-decimal precision,
/// and validate freshness against the staleness threshold.
pub fn get_price(ctx: Context<GetPrice>) -> Result<u64> {
    let feed = &mut ctx.accounts.price_feed;
    let clock = Clock::get()?;

    let aggregator_data = ctx.accounts.switchboard_feed.try_borrow_data()?;

    // Validate the aggregator account has enough data
    require!(
        aggregator_data.len() >= SWITCHBOARD_RESULT_OFFSET + 16,
        OracleError::InsufficientAggregatorData
    );

    // Read the i128 mantissa from the Switchboard aggregator's latest confirmed round
    let mantissa_bytes: [u8; 16] = aggregator_data[SWITCHBOARD_RESULT_OFFSET..SWITCHBOARD_RESULT_OFFSET + 16]
        .try_into()
        .map_err(|_| OracleError::InvalidSwitchboardAccount)?;
    let mantissa = i128::from_le_bytes(mantissa_bytes);

    // Validate the price is positive
    require!(mantissa > 0, OracleError::InvalidPrice);

    // Convert from Switchboard 18-decimal precision to our 6-decimal precision
    // price = mantissa / 10^(SWITCHBOARD_DECIMALS - 6)
    let scale_factor = 10i128.pow((SWITCHBOARD_DECIMALS - 6) as u32);
    let price_i128 = mantissa.checked_div(scale_factor)
        .ok_or(OracleError::ArithmeticOverflow)?;

    require!(price_i128 > 0, OracleError::InvalidPrice);
    let price = price_i128 as u64;

    // Check staleness — reject if the last update was too long ago
    if feed.last_updated > 0 {
        let age = clock.unix_timestamp
            .checked_sub(feed.last_updated)
            .unwrap_or(i64::MAX);
        require!(age <= feed.staleness_threshold, OracleError::StalePriceFeed);
    }

    // Update cached price and timestamp
    feed.last_price = price;
    feed.last_updated = clock.unix_timestamp;

    Ok(price)
}

// ============================================================
// Calculate Mint / Redeem Amounts
// ============================================================

/// Given `fiat_amount` units of fiat currency, calculate how many tokens to mint.
/// Formula: tokens = fiat_amount * PRECISION / price
pub fn calculate_mint_amount(ctx: Context<GetPrice>, fiat_amount: u64) -> Result<u64> {
    let price = get_price(ctx)?;

    let tokens = (fiat_amount as u128)
        .checked_mul(PRICE_PRECISION as u128)
        .ok_or(OracleError::ArithmeticOverflow)?
        .checked_div(price as u128)
        .ok_or(OracleError::ArithmeticOverflow)?;

    Ok(tokens as u64)
}

/// Given `token_amount` tokens, calculate how much fiat currency they're worth.
/// Formula: fiat = token_amount * price / PRECISION
pub fn calculate_redeem_amount(ctx: Context<GetPrice>, token_amount: u64) -> Result<u64> {
    let price = get_price(ctx)?;

    let fiat = (token_amount as u128)
        .checked_mul(price as u128)
        .ok_or(OracleError::ArithmeticOverflow)?
        .checked_div(PRICE_PRECISION as u128)
        .ok_or(OracleError::ArithmeticOverflow)?;

    Ok(fiat as u64)
}
