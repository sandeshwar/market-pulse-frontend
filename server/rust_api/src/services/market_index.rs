use crate::models::market_index::{MarketIndex, MarketIndicesCollection, MarketStatus};
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use chrono::Utc;

/// Service for managing market indices
#[derive(Clone)]
pub struct MarketIndexService {
    indices: Arc<RwLock<MarketIndicesCollection>>,
    redis: RedisManager,
}

impl MarketIndexService {
    /// Creates a new market index service
    pub async fn new() -> Self {
        let redis = RedisManager::new()
            .expect("Failed to create Redis manager");

        let service = Self {
            indices: Arc::new(RwLock::new(MarketIndicesCollection::new())),
            redis,
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

        // Initialize with default indices
        let mut indices_map = HashMap::new();

        // Add default indices with placeholder values
        indices_map.insert(
            "SPX".to_string(),
            MarketIndex::new(
            "SPX".to_string(),
            "S&P 500".to_string(),
            4532.12,
            45.23,
            1.01,
            MarketStatus::Closed,
            ),
        );
        
        indices_map.insert(
            "DJI".to_string(),
            MarketIndex::new(
            "DJI".to_string(),
            "Dow Jones".to_string(),
            35721.34,
            324.56,
            0.92,
            MarketStatus::Closed,
            ),
        );
        
        indices_map.insert(
            "IXIC".to_string(),
            MarketIndex::new(
            "IXIC".to_string(),
            "NASDAQ".to_string(),
            14897.23,
            178.91,
            1.21,
            MarketStatus::Open,
            ),
        );
        
        indices_map.insert(
            "NDX".to_string(),
            MarketIndex::new(
            "NDX".to_string(),
            "NASDAQ 100".to_string(),
            15632.45,
            203.67,
            1.32,
            MarketStatus::Closed,
            ),
        );
        
        indices_map.insert(
            "VIX".to_string(),
            MarketIndex::new(
            "VIX".to_string(),
            "VIX".to_string(),
            18.45,
            -0.87,
            -4.51,
            MarketStatus::Closed,
            ),
        );
        
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
}