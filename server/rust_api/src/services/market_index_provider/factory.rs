use crate::services::market_index_provider::provider::MarketIndexProvider;
use crate::models::market_index::MarketIndex;
use crate::models::error::ApiError;
use async_trait::async_trait;
use std::sync::Arc;
use chrono::Utc;

/// A dummy provider that always returns empty results
struct DummyProvider;

#[async_trait]
impl MarketIndexProvider for DummyProvider {
    async fn fetch_market_indices(&self, _indices: &[String]) -> Result<Vec<MarketIndex>, ApiError> {
        tracing::info!("Dummy provider: market indices are disabled for testing");
        Ok(Vec::new())
    }

    fn provider_name(&self) -> &str {
        "Dummy Provider (Testing Mode)"
    }
}

/// Factory for creating market index providers
pub struct MarketIndexProviderFactory;

impl MarketIndexProviderFactory {
    /// Creates a new market index provider (currently always returns the dummy provider)
    pub fn create(provider_name: &str) -> Arc<dyn MarketIndexProvider> {
        tracing::info!("Market indices disabled for testing (requested provider: {})", provider_name);
        Arc::new(DummyProvider)
    }

    /// Returns a list of available provider names
    pub fn available_providers() -> Vec<String> {
        vec!["wsj".to_string(), "google".to_string()]
    }
}