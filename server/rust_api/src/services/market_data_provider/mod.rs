pub mod paytm;
pub mod paytm_websocket;
pub mod tiingo;

use crate::models::symbol::SymbolPrice;
use crate::models::market_index::MarketIndex;
use crate::models::error::ApiError;

/// Trait defining the interface for market data providers
#[allow(dead_code)]
#[allow(async_fn_in_trait)]
pub trait MarketDataProvider: Send + Sync {
    /// Fetches market data for a list of symbols
    async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError>;

    /// Fetches market index data
    async fn fetch_market_indices(&self, indices: &[String]) -> Result<Vec<MarketIndex>, ApiError>;
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

// Implement the trait for PaytmMoneyClient
impl MarketDataProvider for paytm::PaytmMoneyClient {
    async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError> {
        self.fetch_market_data(symbols).await
    }

    async fn fetch_market_indices(&self, indices: &[String]) -> Result<Vec<MarketIndex>, ApiError> {
        self.fetch_market_indices(indices).await
    }
}

// Implement the real-time trait for PaytmWebSocketClient
impl RealTimeMarketDataProvider for paytm_websocket::PaytmWebSocketClient {
    async fn subscribe(&self, symbols: &[String]) -> Result<(), ApiError> {
        self.subscribe(symbols).await
    }

    async fn unsubscribe(&self, symbols: &[String]) -> Result<(), ApiError> {
        self.unsubscribe(symbols).await
    }
}

// Implement the trait for TiingoClient
impl MarketDataProvider for tiingo::TiingoClient {
    async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError> {
        self.fetch_market_data(symbols).await
    }

    async fn fetch_market_indices(&self, indices: &[String]) -> Result<Vec<MarketIndex>, ApiError> {
        self.fetch_market_indices(indices).await
    }
}