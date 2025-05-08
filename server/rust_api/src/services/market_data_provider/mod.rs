pub mod upstox;

use crate::models::symbol::SymbolPrice;
use crate::models::error::ApiError;

/// Trait defining the interface for market data providers
#[allow(dead_code)]
#[allow(async_fn_in_trait)]
pub trait MarketDataProvider: Send + Sync {
    /// Fetches market data for a list of symbols
    async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError>;
}

/// Trait defining the interface for real-time market data providers
#[allow(dead_code)]
#[allow(async_fn_in_trait)]
pub trait RealTimeMarketDataProvider: Send + Sync {
    /// Subscribes to real-time updates for a list of symbols
    async fn subscribe(&self, symbols: &[String]) -> Result<(), ApiError>;

    /// Unsubscribes from real-time updates for a list of symbols
    async fn unsubscribe(&self, symbols: &[String]) -> Result<(), ApiError>;
}

// Implement the trait for UpstoxClient
impl MarketDataProvider for upstox::UpstoxClient {
    async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError> {
        self.fetch_market_data(symbols).await
    }
}