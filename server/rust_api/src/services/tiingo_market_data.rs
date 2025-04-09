use crate::models::symbol::{SymbolPrice, BatchPriceResponse};
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
use futures_util::future;
use futures_util::stream::{self as stream, StreamExt};
// use downcast_rs::Downcast;

/// Key prefix for symbol price data in Redis
const SYMBOL_PRICE_PREFIX: &str = "market_data:symbol:";

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

        // Spawn the background task with immediate first update
        tokio::spawn(async move {
            tracing::info!("Starting initial market data update");
            
            // Try initial update with timeout
            match tokio::time::timeout(
                StdDuration::from_secs(30),
                service.update_all_cached_data()
            ).await {
                Ok(Ok(_)) => tracing::info!("Initial market data update completed successfully"),
                Ok(Err(e)) => tracing::error!("Initial market data update failed: {}", e),
                Err(_) => tracing::error!("Initial market data update timed out after 30 seconds"),
            }

            let mut interval = tokio::time::interval(StdDuration::from_secs(update_interval));
            
            loop {
                interval.tick().await;

                tracing::debug!("Running scheduled market data update");
                match tokio::time::timeout(
                    StdDuration::from_secs(30),
                    service.update_all_cached_data()
                ).await {
                    Ok(Ok(_)) => tracing::debug!("Scheduled market data update completed"),
                    Ok(Err(e)) => tracing::error!("Scheduled market data update failed: {}", e),
                    Err(_) => tracing::error!("Scheduled market data update timed out after 30 seconds"),
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

        // Track accessed symbols in the background
        let track_symbols = symbols.to_vec();
        let track_service = self.clone();
        tokio::spawn(async move {
            if let Err(e) = track_service.track_accessed_symbols(&track_symbols).await {
                tracing::error!("Failed to track accessed symbols: {}", e);
            }
        });

        // Check cache for each symbol in parallel
        let mut cached_prices = HashMap::new();
        let mut symbols_to_fetch = Vec::new();
        
        // Create futures for all Redis get operations
        let redis_futures = symbols.iter().map(|symbol| {
            let symbol = symbol.clone();
            let redis = self.redis.clone();
            let key = format!("{}{}", SYMBOL_PRICE_PREFIX, symbol);
            
            async move {
                match redis.get::<SymbolPrice>(&key).await {
                    Ok(Some(price)) => (symbol, Some(price)),
                    _ => (symbol, None),
                }
            }
        }).collect::<Vec<_>>();
        
        // Execute all Redis operations in parallel
        let redis_results = future::join_all(redis_futures).await;
        
        // Process results
        for (symbol, price_opt) in redis_results {
            match price_opt {
                Some(price) => {
                    cached_prices.insert(symbol, price);
                },
                None => {
                    symbols_to_fetch.push(symbol);
                }
            }
        }

        // Fetch missing symbols from the provider
        if !symbols_to_fetch.is_empty() {
            tracing::debug!("Fetching {} symbols from provider", symbols_to_fetch.len());
            let fresh_prices = self.provider.fetch_market_data(&symbols_to_fetch).await?;

            // Check if we got any results back
            if fresh_prices.is_empty() && !symbols_to_fetch.is_empty() {
                tracing::warn!("No data returned from Tiingo for symbols: {:?}", symbols_to_fetch);

                // Return a specific error if no symbols were found
                if cached_prices.is_empty() {
                    return Err(ApiError::NotFound(format!(
                        "No data available for the requested symbols. They may not be supported by Tiingo."
                    )));
                }
            }

            // Cache the fresh data in parallel
            let cache_futures = fresh_prices.iter().map(|price| {
                let price = price.clone();
                let redis = self.redis.clone();
                let cache_duration = self.cache_duration;
                let key = format!("{}{}", SYMBOL_PRICE_PREFIX, price.symbol);
                
                async move {
                    if let Err(e) = redis.set(&key, &price, Some(cache_duration as usize)).await {
                        tracing::error!("Failed to cache symbol price for {}: {}", price.symbol, e);
                    }
                    price
                }
            }).collect::<Vec<_>>();
            
            // Execute all cache operations in parallel
            let cached_prices_results = future::join_all(cache_futures).await;
            
            // Add fresh prices to the result map
            for price in cached_prices_results {
                cached_prices.insert(price.symbol.clone(), price);
            }
        }

        Ok(BatchPriceResponse {
            prices: cached_prices,
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

            let _: () = redis::cmd("DEL")
                .arg(&symbol_key)
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

        // Get symbols to update
        let symbols = self.get_symbols_to_update().await?;

        tracing::info!("Updating {} symbols", symbols.len());

        // Process symbols in parallel batches of 20 for better throughput control
        let batch_size = 20;
        let mut futures = Vec::new();

        for chunk in symbols.chunks(batch_size) {
            let chunk_symbols = chunk.to_vec();
            let provider = self.provider.clone();
            let redis = self.redis.clone();
            let cache_duration = self.cache_duration;

            // Create a future for each batch
            let future = async move {
                match provider.fetch_market_data(&chunk_symbols).await {
                    Ok(prices) => {
                        // Cache the fresh data
                        for price in &prices {
                            let key = format!("{}{}", SYMBOL_PRICE_PREFIX, price.symbol);
                            if let Err(e) = redis.set(&key, price, Some(cache_duration as usize)).await {
                                tracing::error!("Failed to cache symbol price for {}: {}", price.symbol, e);
                            }
                        }
                        Ok(prices.len())
                    },
                    Err(e) => {
                        tracing::error!("Failed to update symbol data batch: {}", e);
                        Err(e)
                    }
                }
            };

            futures.push(future);
        }

        // Execute all batch futures with some concurrency control
        // Just use join_all since we already have a Vec of futures
        let results = future::join_all(futures).await;

        // Log results
        let mut updated_count = 0;
        let mut error_count = 0;

        for result in results {
            match result {
                Ok(count) => updated_count += count,
                Err(_) => error_count += 1,
            }
        }

        tracing::info!("Updated {} symbols with {} batch errors", updated_count, error_count);

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