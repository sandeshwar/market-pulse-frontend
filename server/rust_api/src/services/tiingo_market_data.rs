use crate::models::symbol::{SymbolPrice, BatchPriceResponse};
use crate::models::market_index::{MarketIndex, MarketIndicesCollection};
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
use crate::services::market_data_provider::tiingo::TiingoClient;
use crate::services::market_data::MarketDataProvider;
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::Mutex;
use chrono::{Utc, Duration};
use std::env;
use std::time::Duration as StdDuration;
use async_trait::async_trait;
use downcast_rs::Downcast;

/// Key prefix for symbol price data in Redis
const SYMBOL_PRICE_PREFIX: &str = "market_data:symbol:";

/// Key prefix for market index data in Redis
const MARKET_INDEX_PREFIX: &str = "market_data:index:";

/// Key for tracking accessed symbols
const ACCESSED_SYMBOLS_KEY: &str = "market_data:accessed_symbols";

/// Service for managing market data using Tiingo API
#[derive(Clone)]
pub struct TiingoMarketDataService {
    redis: RedisManager,
    provider: Arc<TiingoClient>,
    cache_duration: i64,
    stale_threshold: i64,
    update_lock: Arc<Mutex<()>>,
}

impl TiingoMarketDataService {
    /// Creates a new market data service
    pub fn new() -> Self {
        let redis = RedisManager::new()
            .expect("Failed to create Redis manager");

        // Get configuration from environment variables
        let api_key = env::var("TIINGO_API_KEY")
            .unwrap_or_else(|_| "demo_api_key".to_string());

        let cache_duration = env::var("MARKET_DATA_CACHE_DURATION")
            .ok()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(60); // Default to 60 seconds

        let stale_threshold = env::var("MARKET_DATA_STALE_THRESHOLD")
            .ok()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(300); // Default to 5 minutes

        // Create the Tiingo provider
        let tiingo_client = TiingoClient::new(api_key);
        let provider = Arc::new(tiingo_client);

        Self {
            redis,
            provider,
            cache_duration,
            stale_threshold,
            update_lock: Arc::new(Mutex::new(())),
        }
    }
}

impl TiingoMarketDataService {
    /// Starts the background update task
    pub async fn start_background_updater(service: Arc<Self>) {
        let update_interval = env::var("MARKET_DATA_UPDATE_INTERVAL")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60); // Default to 60 seconds

        tracing::info!("Starting market data background updater with interval of {} seconds", update_interval);

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(StdDuration::from_secs(update_interval));

            loop {
                interval.tick().await;

                tracing::debug!("Running scheduled market data update");
                if let Err(e) = service.update_all_cached_data().await {
                    tracing::error!("Scheduled market data update failed: {}", e);
                }
            }
        });
    }

    /// Starts the WebSocket listener for real-time updates
    pub async fn start_websocket_listener(_service: Arc<Self>) {
        // Tiingo service doesn't support WebSocket
        tracing::info!("WebSocket not supported for Tiingo service");
    }
}

#[async_trait]
impl MarketDataProvider for TiingoMarketDataService {
    /// Gets price data for a list of symbols
    async fn get_symbol_prices(&self, symbols: &[String]) -> Result<BatchPriceResponse, ApiError> {
        if symbols.is_empty() {
            return Ok(BatchPriceResponse {
                prices: HashMap::new(),
                timestamp: Some(Utc::now()),
            });
        }

        // Track accessed symbols
        self.track_accessed_symbols(symbols).await?;

        // Check cache for each symbol
        let mut cached_prices = HashMap::new();
        let mut symbols_to_fetch = Vec::new();

        for symbol in symbols {
            let key = format!("{}{}", SYMBOL_PRICE_PREFIX, symbol);
            match self.redis.get::<SymbolPrice>(&key).await {
                Ok(Some(price)) => {
                    cached_prices.insert(symbol.clone(), price);
                }
                _ => {
                    symbols_to_fetch.push(symbol.clone());
                }
            }
        }

        // Fetch missing symbols from the provider
        if !symbols_to_fetch.is_empty() {
            let fresh_prices = self.provider.fetch_market_data(&symbols_to_fetch).await?;

            // Cache the fresh data
            for price in &fresh_prices {
                let key = format!("{}{}", SYMBOL_PRICE_PREFIX, price.symbol);
                if let Err(e) = self.redis.set(&key, price, Some(self.cache_duration as usize)).await {
                    tracing::error!("Failed to cache symbol price for {}: {}", price.symbol, e);
                }

                cached_prices.insert(price.symbol.clone(), price.clone());
            }
        }

        Ok(BatchPriceResponse {
            prices: cached_prices,
            timestamp: Some(Utc::now()),
        })
    }

    /// Gets market index data
    async fn get_market_indices(&self, indices: &[String]) -> Result<MarketIndicesCollection, ApiError> {
        if indices.is_empty() {
            return Ok(MarketIndicesCollection::new());
        }

        // Track accessed indices
        self.track_accessed_symbols(indices).await?;

        // Check cache for each index
        let mut cached_indices = HashMap::new();
        let mut indices_to_fetch = Vec::new();

        for index in indices {
            let key = format!("{}{}", MARKET_INDEX_PREFIX, index);
            match self.redis.get::<MarketIndex>(&key).await {
                Ok(Some(index_data)) => {
                    cached_indices.insert(index.clone(), index_data);
                }
                _ => {
                    indices_to_fetch.push(index.clone());
                }
            }
        }

        // Fetch missing indices from the provider
        if !indices_to_fetch.is_empty() {
            let fresh_indices = self.provider.fetch_market_indices(&indices_to_fetch).await?;

            // Cache the fresh data
            for index in &fresh_indices {
                let key = format!("{}{}", MARKET_INDEX_PREFIX, index.symbol);
                if let Err(e) = self.redis.set(&key, index, Some(self.cache_duration as usize)).await {
                    tracing::error!("Failed to cache market index for {}: {}", index.symbol, e);
                }

                cached_indices.insert(index.symbol.clone(), index.clone());
            }
        }

        Ok(MarketIndicesCollection {
            indices: cached_indices,
            timestamp: Some(Utc::now()),
        })
    }

    /// Tracks which symbols are being accessed
    async fn track_accessed_symbols(&self, symbols: &[String]) -> Result<(), ApiError> {
        let now = Utc::now().timestamp();

        let mut conn = self.redis.get_connection().await
            .map_err(|e| ApiError::InternalError(format!("Redis connection error: {}", e)))?;

        for symbol in symbols {
            // Use ZADD to store the symbol with current timestamp as score
            let _: () = redis::cmd("ZADD")
                .arg(ACCESSED_SYMBOLS_KEY)
                .arg(now)
                .arg(symbol)
                .query_async(&mut conn)
                .await
                .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;
        }

        Ok(())
    }

    /// Gets all symbols that need to be updated (cache expired)
    async fn get_symbols_to_update(&self) -> Result<Vec<String>, ApiError> {
        let mut conn = self.redis.get_connection().await
            .map_err(|e| ApiError::InternalError(format!("Redis connection error: {}", e)))?;

        // Get all accessed symbols
        let symbols: Vec<String> = redis::cmd("ZRANGE")
            .arg(ACCESSED_SYMBOLS_KEY)
            .arg(0)
            .arg(-1)
            .query_async(&mut conn)
            .await
            .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

        let mut symbols_to_update = Vec::new();

        for symbol in symbols {
            let key = format!("{}{}", SYMBOL_PRICE_PREFIX, symbol);

            // Check if the key exists and when it will expire
            let ttl: i64 = redis::cmd("TTL")
                .arg(&key)
                .query_async(&mut conn)
                .await
                .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

            // If TTL is -2, the key doesn't exist
            // If TTL is -1, the key exists but has no expiry
            // If TTL is <= 10, the key will expire soon
            if ttl == -2 || ttl <= 10 {
                symbols_to_update.push(symbol);
            }
        }

        Ok(symbols_to_update)
    }

    /// Gets all indices that need to be updated (cache expired)
    async fn get_indices_to_update(&self) -> Result<Vec<String>, ApiError> {
        let mut conn = self.redis.get_connection().await
            .map_err(|e| ApiError::InternalError(format!("Redis connection error: {}", e)))?;

        // Get all accessed indices (they're tracked in the same set as symbols)
        let indices: Vec<String> = redis::cmd("ZRANGE")
            .arg(ACCESSED_SYMBOLS_KEY)
            .arg(0)
            .arg(-1)
            .query_async(&mut conn)
            .await
            .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

        let mut indices_to_update = Vec::new();

        for index in indices {
            let key = format!("{}{}", MARKET_INDEX_PREFIX, index);

            // Check if the key exists and when it will expire
            let ttl: i64 = redis::cmd("TTL")
                .arg(&key)
                .query_async(&mut conn)
                .await
                .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

            // If TTL is -2, the key doesn't exist
            // If TTL is -1, the key exists but has no expiry
            // If TTL is <= 10, the key will expire soon
            if ttl == -2 || ttl <= 10 {
                indices_to_update.push(index);
            }
        }

        Ok(indices_to_update)
    }

    /// Removes stale symbols from the cache
    async fn remove_stale_symbols(&self) -> Result<(), ApiError> {
        let stale_cutoff = Utc::now() - Duration::seconds(self.stale_threshold);
        let stale_timestamp = stale_cutoff.timestamp();

        let mut conn = self.redis.get_connection().await
            .map_err(|e| ApiError::InternalError(format!("Redis connection error: {}", e)))?;

        // Get stale symbols (symbols not accessed since stale_cutoff)
        let stale_symbols: Vec<String> = redis::cmd("ZRANGEBYSCORE")
            .arg(ACCESSED_SYMBOLS_KEY)
            .arg(0)
            .arg(stale_timestamp)
            .query_async(&mut conn)
            .await
            .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

        if stale_symbols.is_empty() {
            return Ok(());
        }

        tracing::info!("Removing {} stale symbols from cache", stale_symbols.len());

        // Remove stale symbols from the accessed set
        let _: () = redis::cmd("ZREM")
            .arg(ACCESSED_SYMBOLS_KEY)
            .arg(&stale_symbols)
            .query_async(&mut conn)
            .await
            .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

        // Remove stale symbols from the cache
        for symbol in &stale_symbols {
            let symbol_key = format!("{}{}", SYMBOL_PRICE_PREFIX, symbol);
            let index_key = format!("{}{}", MARKET_INDEX_PREFIX, symbol);

            let _: () = redis::cmd("DEL")
                .arg(&symbol_key)
                .query_async(&mut conn)
                .await
                .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;

            let _: () = redis::cmd("DEL")
                .arg(&index_key)
                .query_async(&mut conn)
                .await
                .map_err(|e| ApiError::InternalError(format!("Redis error: {}", e)))?;
        }

        Ok(())
    }

    /// Updates all cached market data
    async fn update_all_cached_data(&self) -> Result<(), ApiError> {
        // Use a lock to prevent multiple concurrent updates
        let _lock = self.update_lock.lock().await;

        // Get symbols and indices to update
        let symbols = self.get_symbols_to_update().await?;
        let indices = self.get_indices_to_update().await?;

        tracing::info!("Updating {} symbols and {} indices", symbols.len(), indices.len());

        // Update symbols in batches of 20
        for chunk in symbols.chunks(20) {
            match self.provider.fetch_market_data(chunk).await {
                Ok(prices) => {
                    // Cache the fresh data
                    for price in &prices {
                        let key = format!("{}{}", SYMBOL_PRICE_PREFIX, price.symbol);
                        if let Err(e) = self.redis.set(&key, price, Some(self.cache_duration as usize)).await {
                            tracing::error!("Failed to cache symbol price for {}: {}", price.symbol, e);
                        }
                    }
                },
                Err(e) => {
                    tracing::error!("Failed to update symbol data: {}", e);
                    continue;
                }
            }
        }

        // Update indices in batches of 10
        for chunk in indices.chunks(10) {
            match self.provider.fetch_market_indices(chunk).await {
                Ok(indices_data) => {
                    // Cache the fresh data
                    for index_data in &indices_data {
                        let key = format!("{}{}", MARKET_INDEX_PREFIX, index_data.symbol);
                        if let Err(e) = self.redis.set(&key, index_data, Some(self.cache_duration as usize)).await {
                            tracing::error!("Failed to cache market index for {}: {}", index_data.symbol, e);
                        }
                    }
                },
                Err(e) => {
                    tracing::error!("Failed to update index data: {}", e);
                    continue;
                }
            }
        }

        // Remove stale symbols
        if let Err(e) = self.remove_stale_symbols().await {
            tracing::error!("Failed to remove stale symbols: {}", e);
        }

        Ok(())
    }

    /// Subscribes to real-time updates for a list of symbols
    async fn subscribe_to_symbols(&self, _symbols: &[String]) -> Result<(), ApiError> {
        // Tiingo service doesn't support WebSocket subscriptions
        Ok(())
    }

    /// Unsubscribes from real-time updates for a list of symbols
    async fn unsubscribe_from_symbols(&self, _symbols: &[String]) -> Result<(), ApiError> {
        // Tiingo service doesn't support WebSocket subscriptions
        Ok(())
    }
}