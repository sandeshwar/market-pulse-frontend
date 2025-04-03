use crate::models::symbol::BatchPriceResponse;
use crate::models::error::ApiError;
use std::sync::Arc;
use async_trait::async_trait;

/// Trait defining the interface for market data services
#[async_trait]
pub trait MarketDataProvider: Send + Sync + 'static {
    /// Gets price data for a list of symbols
    async fn get_symbol_prices(&self, symbols: &[String]) -> Result<BatchPriceResponse, ApiError>;

    /// Tracks which symbols are being accessed
    async fn track_accessed_symbols(&self, symbols: &[String]) -> Result<(), ApiError>;

    /// Gets all symbols that need to be updated (cache expired)
    async fn get_symbols_to_update(&self) -> Result<Vec<String>, ApiError>;

    /// Removes stale symbols from the cache
    async fn remove_stale_symbols(&self) -> Result<(), ApiError>;

    /// Updates all cached market data
    async fn update_all_cached_data(&self) -> Result<(), ApiError>;

    /// Subscribes to real-time updates for a list of symbols
    async fn subscribe_to_symbols(&self, symbols: &[String]) -> Result<(), ApiError>;

    /// Unsubscribes from real-time updates for a list of symbols
    async fn unsubscribe_from_symbols(&self, symbols: &[String]) -> Result<(), ApiError>;
}

/// Enum that can hold any of the market data provider implementations
#[derive(Clone)]
pub enum MarketDataProviderEnum {
    Tiingo(Arc<crate::services::tiingo_market_data::TiingoMarketDataService>),
    Indices(Arc<crate::services::indices_market_data::IndicesMarketDataService>),
}


#[async_trait]
impl MarketDataProvider for MarketDataProviderEnum {
    async fn get_symbol_prices(&self, symbols: &[String]) -> Result<BatchPriceResponse, ApiError> {
        match self {
            MarketDataProviderEnum::Tiingo(service) => service.get_symbol_prices(symbols).await,
            MarketDataProviderEnum::Indices(service) => service.get_symbol_prices(symbols).await,
        }
    }

    async fn track_accessed_symbols(&self, symbols: &[String]) -> Result<(), ApiError> {
        match self {
            MarketDataProviderEnum::Tiingo(service) => service.track_accessed_symbols(symbols).await,
            MarketDataProviderEnum::Indices(service) => service.track_accessed_symbols(symbols).await,
        }
    }

    async fn get_symbols_to_update(&self) -> Result<Vec<String>, ApiError> {
        match self {
            MarketDataProviderEnum::Tiingo(service) => service.get_symbols_to_update().await,
            MarketDataProviderEnum::Indices(service) => service.get_symbols_to_update().await,
        }
    }

    async fn remove_stale_symbols(&self) -> Result<(), ApiError> {
        match self {
            MarketDataProviderEnum::Tiingo(service) => service.remove_stale_symbols().await,
            MarketDataProviderEnum::Indices(service) => service.remove_stale_symbols().await,
        }
    }

    async fn update_all_cached_data(&self) -> Result<(), ApiError> {
        match self {
            MarketDataProviderEnum::Tiingo(service) => service.update_all_cached_data().await,
            MarketDataProviderEnum::Indices(service) => service.update_all_cached_data().await,
        }
    }

    async fn subscribe_to_symbols(&self, symbols: &[String]) -> Result<(), ApiError> {
        match self {
            MarketDataProviderEnum::Tiingo(service) => service.subscribe_to_symbols(symbols).await,
            MarketDataProviderEnum::Indices(service) => service.subscribe_to_symbols(symbols).await,
        }
    }

    async fn unsubscribe_from_symbols(&self, symbols: &[String]) -> Result<(), ApiError> {
        match self {
            MarketDataProviderEnum::Tiingo(service) => service.unsubscribe_from_symbols(symbols).await,
            MarketDataProviderEnum::Indices(service) => service.unsubscribe_from_symbols(symbols).await,
        }
    }
}

