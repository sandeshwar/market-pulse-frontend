use crate::services::market_index_provider::provider::MarketIndexProvider;
use crate::services::market_index_provider::wsj::WsjMarketIndexProvider;
use crate::services::market_index_provider::google::GoogleMarketIndexProvider;
use crate::models::market_index::MarketIndex;
use crate::models::error::ApiError;
use async_trait::async_trait;
use std::sync::Arc;

/// Enum representing different market index provider types
pub enum MarketIndexProviderType {
    Wsj(WsjMarketIndexProvider),
    Google(GoogleMarketIndexProvider),
}

#[async_trait]
impl MarketIndexProvider for MarketIndexProviderType {
    async fn fetch_market_indices(&self, indices: &[String]) -> Result<Vec<MarketIndex>, ApiError> {
        match self {
            MarketIndexProviderType::Wsj(provider) => provider.fetch_market_indices(indices).await,
            MarketIndexProviderType::Google(provider) => provider.fetch_market_indices(indices).await,
        }
    }

    fn provider_name(&self) -> &str {
        match self {
            MarketIndexProviderType::Wsj(provider) => provider.provider_name(),
            MarketIndexProviderType::Google(provider) => provider.provider_name(),
        }
    }
}

/// Factory for creating market index providers
pub struct MarketIndexProviderFactory;

impl MarketIndexProviderFactory {
    /// Creates a new market index provider based on the provider name
    pub fn create(provider_name: &str) -> Arc<MarketIndexProviderType> {
        match provider_name.to_lowercase().as_str() {
            "wsj" => Arc::new(MarketIndexProviderType::Wsj(WsjMarketIndexProvider::new())),
            "google" => Arc::new(MarketIndexProviderType::Google(GoogleMarketIndexProvider::new())),
            _ => {
                // Default to WSJ provider
                tracing::warn!("Unknown provider '{}', defaulting to WSJ", provider_name);
                Arc::new(MarketIndexProviderType::Wsj(WsjMarketIndexProvider::new()))
            }
        }
    }

    /// Returns a list of available provider names
    pub fn available_providers() -> Vec<String> {
        vec!["wsj".to_string(), "google".to_string()]
    }
}