use crate::models::symbol::{SymbolPrice, BatchPriceResponse};
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
use crate::services::market_data::MarketDataProvider;
use std::sync::Arc;
use std::collections::HashMap;
use chrono::Utc;
use async_trait::async_trait;
use redis::AsyncCommands;
use serde::{Serialize, Deserialize};

/// Key for indices data in Redis (set by the indices_extractor)
const INDICES_KEY: &str = "indices:tradingview:latest";

/// Service for managing indices market data
#[derive(Clone)]
pub struct IndicesMarketDataService {
    redis: RedisManager,
}

/// Represents market index data extracted from TradingView
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IndexData {
    /// Symbol of the index (e.g., "SPX", "DJI")
    pub symbol: String,

    /// Full name of the index (e.g., "S&P 500", "Dow Jones Industrial Average")
    pub name: String,

    /// Current price of the index
    pub price: f64,

    /// Currency of the price (e.g., "USD", "EUR")
    pub currency: String,

    /// Percentage change in price
    pub change_percentage: f64,

    /// Absolute change in price
    pub change_absolute: f64,

    /// Highest price in the current period
    pub high: f64,

    /// Lowest price in the current period
    pub low: f64,

    /// Technical rating (e.g., "Strong Buy", "Sell")
    pub technical_rating: String,

    /// Timestamp when the data was extracted
    pub timestamp: chrono::DateTime<Utc>,
}

/// Collection of index data with metadata
#[derive(Debug, Serialize, Deserialize)]
struct IndicesCollection {
    /// List of index data
    pub indices: Vec<IndexData>,

    /// Timestamp when the collection was created
    pub timestamp: chrono::DateTime<Utc>,

    /// Source URL of the data
    pub source: String,
}

impl IndicesMarketDataService {
    /// Creates a new indices market data service
    pub fn new() -> Self {
        let redis = RedisManager::new()
            .expect("Failed to create Redis manager");

        Self {
            redis,
        }
    }

    /// Converts IndexData to SymbolPrice
    fn convert_to_symbol_price(&self, index: &IndexData) -> SymbolPrice {
        let mut additional_data = HashMap::new();

        additional_data.insert("currency".to_string(), serde_json::to_value(&index.currency).unwrap_or_default());
        additional_data.insert("name".to_string(), serde_json::to_value(&index.name).unwrap_or_default());
        additional_data.insert("highPrice".to_string(), serde_json::to_value(index.high).unwrap_or_default());
        additional_data.insert("lowPrice".to_string(), serde_json::to_value(index.low).unwrap_or_default());
        additional_data.insert("technicalRating".to_string(), serde_json::to_value(&index.technical_rating).unwrap_or_default());

        SymbolPrice {
            symbol: index.symbol.clone(),
            price: index.price,
            change: index.change_absolute,
            percent_change: index.change_percentage,
            volume: 0, // Indices don't have volume in the same way stocks do
            timestamp: Some(index.timestamp),
            additional_data,
        }
    }
}

#[async_trait]
impl MarketDataProvider for IndicesMarketDataService {
    /// Gets price data for a list of indices
    async fn get_symbol_prices(&self, symbols: &[String]) -> Result<BatchPriceResponse, ApiError> {
        // Get the latest indices collection from Redis
        let mut conn = self.redis.get_connection().await
            .map_err(|e| ApiError::InternalError(format!("Redis connection error: {}", e)))?;

        let data: Option<String> = conn.get(INDICES_KEY).await
            .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

        let indices_collection = match data {
            Some(serialized) => {
                match serde_json::from_str::<IndicesCollection>(&serialized) {
                    Ok(collection) => collection,
                    Err(e) => {
                        tracing::error!("Failed to deserialize indices collection: {}", e);
                        return Err(ApiError::InternalError(format!("Failed to deserialize indices data: {}", e)));
                    }
                }
            },
            None => {
                tracing::warn!("No indices data found in Redis");
                return Err(ApiError::NotFound("No indices data available".to_string()));
            }
        };

        // If no specific symbols requested, return all indices
        let filtered_indices = if symbols.is_empty() {
            indices_collection.indices
        } else {
            // Filter indices by requested symbols
            let symbols_set: std::collections::HashSet<String> = symbols.iter().cloned().collect();
            indices_collection.indices.into_iter()
                .filter(|index| symbols_set.contains(&index.symbol))
                .collect()
        };

        if !symbols.is_empty() && filtered_indices.is_empty() {
            return Err(ApiError::NotFound(format!(
                "No data available for the requested indices: {:?}", symbols
            )));
        }

        // Convert to SymbolPrice format
        let mut prices = HashMap::new();
        for index in filtered_indices {
            let symbol_price = self.convert_to_symbol_price(&index);
            prices.insert(index.symbol.clone(), symbol_price);
        }

        Ok(BatchPriceResponse {
            prices,
            timestamp: Some(Utc::now()),
        })
    }

    /// Tracks which indices are being accessed - not needed for indices
    async fn track_accessed_symbols(&self, _symbols: &[String]) -> Result<(), ApiError> {
        // No need to track accessed symbols for indices
        Ok(())
    }

    /// Gets all indices that need to be updated - not needed for indices
    async fn get_symbols_to_update(&self) -> Result<Vec<String>, ApiError> {
        // No need to update individual symbols for indices
        Ok(Vec::new())
    }

    /// Removes stale indices from the cache - not needed for indices
    async fn remove_stale_symbols(&self) -> Result<(), ApiError> {
        // No need to remove stale symbols for indices
        Ok(())
    }

    /// Updates all cached indices data - not needed as the indices_extractor handles this
    async fn update_all_cached_data(&self) -> Result<(), ApiError> {
        // No need to update cached data as the indices_extractor handles this
        Ok(())
    }

    /// Subscribes to real-time updates for a list of indices - not supported
    async fn subscribe_to_symbols(&self, _symbols: &[String]) -> Result<(), ApiError> {
        // Indices service doesn't support WebSocket subscriptions
        Ok(())
    }

    /// Unsubscribes from real-time updates for a list of indices - not supported
    async fn unsubscribe_from_symbols(&self, _symbols: &[String]) -> Result<(), ApiError> {
        // Indices service doesn't support WebSocket subscriptions
        Ok(())
    }
}