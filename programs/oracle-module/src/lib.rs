use anchor_lang::prelude::*;

pub mod feeds;
pub use feeds::*;

declare_id!("Hx8AXzQd8eh5Z7VFTE6uRrk5Zm3WMTYLrMAFu61hbWj5");

#[program]
pub mod oracle_module {
    use super::*;

    /// Register a new price feed for a stablecoin mint.
    pub fn register_feed(
        ctx: Context<RegisterFeed>,
        currency: String,
        staleness_threshold: i64,
    ) -> Result<()> {
        feeds::register_feed(ctx, currency, staleness_threshold)
    }

    /// Read the latest price from the Switchboard aggregator.
    pub fn get_price(ctx: Context<GetPrice>) -> Result<u64> {
        feeds::get_price(ctx)
    }

    /// Calculate how many tokens to mint for a given fiat amount.
    pub fn calculate_mint_amount(ctx: Context<GetPrice>, fiat_amount: u64) -> Result<u64> {
        feeds::calculate_mint_amount(ctx, fiat_amount)
    }

    /// Calculate how much fiat a given token amount is worth.
    pub fn calculate_redeem_amount(ctx: Context<GetPrice>, token_amount: u64) -> Result<u64> {
        feeds::calculate_redeem_amount(ctx, token_amount)
    }
}
