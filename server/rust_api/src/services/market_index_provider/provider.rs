use crate::models::market_index::MarketIndex;
use crate::models::error::ApiError;
use async_trait::async_trait;

/// Trait defining the interface for market index data providers
#[async_trait]
pub trait MarketIndexProvider: Send + Sync {
    /// Fetches market index data for a list of index symbols
    async fn fetch_market_indices(&self, indices: &[String]) -> Result<Vec<MarketIndex>, ApiError>;
    
    /// Returns the name of the provider
    fn provider_name(&self) -> &str;
}