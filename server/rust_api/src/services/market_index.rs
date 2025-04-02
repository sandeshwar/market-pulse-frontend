use crate::models::market_index::{MarketIndex, MarketIndicesCollection, MarketStatus};
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
use crate::config::market_indices;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use chrono::Utc;

use crate::services::market_index_provider::provider::MarketIndexProvider;

/// Service for managing market indices
#[derive(Clone)]
pub struct MarketIndexService {
    indices: Arc<RwLock<MarketIndicesCollection>>,
    redis: RedisManager,
    provider: Arc<RwLock<Option<Arc<dyn MarketIndexProvider>>>>,
}

impl MarketIndexService {
    /// Creates a new market index service
    pub async fn new() -> Self {
        let redis = RedisManager::new()
            .expect("Failed to create Redis manager");

        let service = Self {
            indices: Arc::new(RwLock::new(MarketIndicesCollection::new())),
            redis,
            provider: Arc::new(RwLock::new(None)),
        };

        // Initialize with default indices
        if let Err(e) = service.initialize_indices().await {
            tracing::error!("Failed to initialize market indices: {}", e);
        }

        service
    }

    /// Initializes the market indices
    async fn initialize_indices(&self) -> Result<(), ApiError> {
        // Clear Redis cache to avoid deserialization issues during development
        if let Err(e) = self.redis.delete("market_indices").await {
            tracing::warn!("Failed to clear Redis market indices cache: {}", e);
        }

        // Try to load from Redis first
        match self.redis.get::<MarketIndicesCollection>("market_indices").await {
            Ok(Some(collection)) => {
                tracing::info!("Loaded {} indices from Redis cache", collection.indices.len());
                let mut indices = self.indices.write().await;
                *indices = collection;
                return Ok(());
            }
            Ok(None) => {
                tracing::info!("No indices found in Redis cache, initializing defaults");
            }
            Err(e) => {
                tracing::error!("Error loading indices from Redis: {}", e);
            }
        }

        // Initialize with default indices from centralized configuration
        let indices_map = market_indices::create_default_indices();

        let collection = MarketIndicesCollection {
            indices: indices_map,
            timestamp: Some(Utc::now()),
        };
        
        // Update the indices collection
        let mut indices = self.indices.write().await;
        *indices = collection.clone();
        
        // Save to Redis for future use
        if let Err(e) = self.redis.set("market_indices", &collection, Some(3600)).await {
            tracing::error!("Failed to save indices to Redis: {}", e);
        }
        
        Ok(())
    }
    
    /// Gets all market indices
    pub async fn get_all_indices(&self) -> Result<MarketIndicesCollection, ApiError> {
        let indices = self.indices.read().await;
        Ok(indices.clone())
    }
    
    /// Gets a specific market index by symbol
    pub async fn get_index(&self, symbol: &str) -> Result<Option<MarketIndex>, ApiError> {
        let indices = self.indices.read().await;
        Ok(indices.get_index(symbol).cloned())
    }
    
    /// Updates a market index
    pub async fn update_index(&self, index: MarketIndex) -> Result<(), ApiError> {
        let mut indices = self.indices.write().await;
        indices.upsert_index(index);

        // Save to Redis
        if let Err(e) = self.redis.set("market_indices", &*indices, Some(3600)).await {
            tracing::error!("Failed to save updated indices to Redis: {}", e);
        }

        Ok(())
    }

    /// Sets the market index provider
    pub async fn set_provider(&self, provider: Arc<dyn MarketIndexProvider>) -> Result<(), ApiError> {
        let mut provider_lock = self.provider.write().await;
        *provider_lock = Some(provider.clone());

        tracing::info!("Market index provider set to: {}", provider.provider_name());

        // Try to refresh indices but don't fail if it doesn't work
        match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            self.refresh_indices()
        ).await {
            Ok(Ok(_)) => {
                tracing::info!("Successfully refreshed market indices");
                Ok(())
            },
            Ok(Err(e)) => {
                tracing::warn!("Failed to refresh market indices: {}. Will use default values.", e);
                Ok(()) // Continue despite the error
            },
            Err(_) => {
                tracing::warn!("Market index refresh timed out. Will use default values.");
                Ok(()) // Continue despite the timeout
            }
        }
    }

    /// Refreshes market indices using the provider
    pub async fn refresh_indices(&self) -> Result<(), ApiError> {
        // Get all index symbols
        let symbols = market_indices::get_all_index_symbols();

        // Check if we have a provider
        let provider_lock = self.provider.read().await;
        let provider = match &*provider_lock {
            Some(p) => p.clone(),
            None => {
                tracing::warn!("No market index provider set, using default values");
                return Ok(());
            }
        };
// Fetch indices from the provider with timeout
tracing::info!("Refreshing market indices using provider: {}", provider.provider_name());
let indices_data = tokio::time::timeout(
    std::time::Duration::from_secs(30),
    provider.fetch_market_indices(&symbols)
).await
.map_err(|_| {
    tracing::error!("Timeout while fetching market indices");
    ApiError::InternalError("Market index provider timed out".to_string())
})??;


        if indices_data.is_empty() {
            tracing::warn!("Provider returned no indices");
            return Ok(());
        }

        // Update our indices collection
        let mut indices = self.indices.write().await;

        for index in indices_data {
            indices.upsert_index(index);
        }

        // Save to Redis
        if let Err(e) = self.redis.set("market_indices", &*indices, Some(3600)).await {
            tracing::error!("Failed to save updated indices to Redis: {}", e);
        }

        tracing::info!("Updated {} market indices", indices.indices.len());

        Ok(())
    }
}