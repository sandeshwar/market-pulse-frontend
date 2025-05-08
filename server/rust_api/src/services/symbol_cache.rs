use std::fs::File;
use std::path::Path;
use std::convert::TryInto;
use std::collections::HashMap;
use csv::ReaderBuilder;
use serde::{Deserialize, Serialize};
use redis::AsyncCommands;
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
use crate::services::upstox_symbols::UpstoxSymbolsService;
use crate::models::symbol::AssetType;
use tracing::{info, debug};

/// Represents a record in the symbols CSV file
#[derive(Debug, Deserialize, Serialize)]
pub struct SymbolRecord {
    pub ticker: String,
    pub exchange: String,
    #[serde(rename = "assetType")]
    pub asset_type: String,
    #[serde(rename = "priceCurrency")]
    pub price_currency: String,
    #[serde(rename = "startDate")]
    pub start_date: Option<String>,
    #[serde(rename = "endDate")]
    pub end_date: Option<String>,
}

/// Service for caching and retrieving market symbols
#[derive(Clone)]
pub struct SymbolCacheService {
    redis: RedisManager,
    symbols_file_path: String,
    cache_ttl_days: u32,
}

impl SymbolCacheService {
    /// Creates a new SymbolCacheService
    pub fn new(redis: RedisManager, symbols_file_path: String, cache_ttl_days: u32) -> Self {
        Self {
            redis,
            symbols_file_path,
            cache_ttl_days,
        }
    }

    /// Initializes the symbol cache by loading symbols from Redis
    pub async fn initialize(&self) -> Result<usize, ApiError> {
        // Check if symbols are already cached
        let mut conn = self.redis.get_connection().await?;
        let cache_exists: bool = conn.exists("symbols:last_updated").await?;

        if cache_exists {
            debug!("Symbol cache already exists, skipping initialization");
            return self.get_symbol_count().await;
        }

        info!("Initializing symbol cache");
        
        // Load Upstox NSE symbols only
        let upstox_count = self.load_upstox_symbols_into_redis().await?;
        
        info!("Initialized symbol cache with {} Upstox NSE symbols", upstox_count);
            
        Ok(upstox_count)
    }

    /// Loads all symbols from the CSV file into Redis
    pub async fn load_symbols_into_redis(&self) -> Result<usize, ApiError> {
        // Check if file exists
        if !Path::new(&self.symbols_file_path).exists() {
            return Err(ApiError::NotFound(format!("Symbols file not found: {}", self.symbols_file_path)));
        }

        // Open and read the CSV file
        let file = File::open(&self.symbols_file_path)
            .map_err(|e| ApiError::InternalError(format!("Failed to open symbols file: {}", e)))?;

        let mut rdr = ReaderBuilder::new()
            .has_headers(true)
            .from_reader(file);

        let mut pipe = redis::pipe();
        let mut counter = 0;

        // Process each record
        for result in rdr.deserialize() {
            let record: SymbolRecord = result
                .map_err(|e| ApiError::InternalError(format!("Failed to parse symbol record: {}", e)))?;

            // Skip empty tickers
            if record.ticker.is_empty() {
                continue;
            }

            // Store as hash
            pipe.hset_multiple(
                format!("symbols:data:{}", record.ticker),
                &[
                    ("exchange", record.exchange.clone()),
                    ("assetType", record.asset_type.clone()),
                    ("priceCurrency", record.price_currency.clone()),
                    ("startDate", record.start_date.clone().unwrap_or_default()),
                    ("endDate", record.end_date.clone().unwrap_or_default()),
                ],
            );

            // Add to sorted set for search (using ticker as score for alphabetical sorting)
            pipe.zadd("symbols:all", record.ticker.clone(), counter as f64);

            // Add to sets for filtering
            pipe.sadd(format!("symbols:exchange:{}", record.exchange), record.ticker.clone());
            pipe.sadd(format!("symbols:assetType:{}", record.asset_type), record.ticker.clone());

            // Add to currency sets
            pipe.sadd(format!("symbols:currency:{}", record.price_currency), record.ticker.clone());

            counter += 1;

            // Execute in batches to avoid huge pipelines
            if counter % 1000 == 0 {
                pipe.query_async::<_, ()>(&mut self.redis.get_connection().await?)
                    .await?;

                pipe = redis::pipe();
                debug!("Loaded {} symbols into Redis", counter);
            }
        }

        // Execute remaining commands
        pipe.query_async::<_, ()>(&mut self.redis.get_connection().await?)
            .await?;

        // Set the last updated timestamp
        let mut conn = self.redis.get_connection().await?;
        let now = chrono::Utc::now().timestamp();
        conn.set::<_, _, ()>("symbols:last_updated", now).await?;

        // Set expiration if TTL is specified
        if self.cache_ttl_days > 0 {
            let ttl_seconds = self.cache_ttl_days * 24 * 60 * 60;
            conn.expire::<_, ()>("symbols:last_updated", (ttl_seconds).try_into().unwrap()).await?;
        }

        info!("Successfully loaded {} symbols into Redis", counter);
        Ok(counter)
    }

    /// Gets the count of symbols in the cache
    pub async fn get_symbol_count(&self) -> Result<usize, ApiError> {
        let mut conn = self.redis.get_connection().await?;
        let count: usize = conn.zcard("symbols:all").await?;

        Ok(count)
    }

    /// Checks if a symbol exists in the cache
    pub async fn symbol_exists(&self, symbol: &str) -> Result<bool, ApiError> {
        let mut conn = self.redis.get_connection().await?;
        let exists: bool = conn.exists(format!("symbols:data:{}", symbol)).await?;

        Ok(exists)
    }

    /// Gets symbol details from the cache
    pub async fn get_symbol_details(&self, symbol: &str) -> Result<Option<SymbolRecord>, ApiError> {
        let mut conn = self.redis.get_connection().await?;
        let exists: bool = conn.exists(format!("symbols:data:{}", symbol)).await?;

        if !exists {
            return Ok(None);
        }

        let data: HashMap<String, String> = conn.hgetall(format!("symbols:data:{}", symbol)).await?;

        if data.is_empty() {
            return Ok(None);
        }

        let record = SymbolRecord {
            ticker: symbol.to_string(),
            exchange: data.get("exchange").cloned().unwrap_or_default(),
            asset_type: data.get("assetType").cloned().unwrap_or_default(),
            price_currency: data.get("priceCurrency").cloned().unwrap_or_default(),
            start_date: data.get("startDate").cloned(),
            end_date: data.get("endDate").cloned(),
        };

        Ok(Some(record))
    }

    /// Searches for symbols by prefix
    pub async fn search_symbols_by_prefix(&self, prefix: &str, limit: usize) -> Result<Vec<SymbolRecord>, ApiError> {
        let mut conn = self.redis.get_connection().await?;

        // Use ZSCAN to find symbols with the given prefix
        let pattern = format!("{}*", prefix.to_uppercase());
        let mut cursor = 0;
        let mut matches = Vec::new();

        loop {
            let (new_cursor, scan_results): (i64, Vec<String>) = redis::cmd("ZSCAN")
                .arg("symbols:all")
                .arg(cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(100)
                .query_async(&mut conn)
                .await?;

            for symbol in scan_results {
                matches.push(symbol);
                if matches.len() >= limit {
                    break;
                }
            }

            cursor = new_cursor;
            if cursor == 0 || matches.len() >= limit {
                break;
            }
        }

        // Get details for each matching symbol
        let mut results = Vec::new();
        for symbol in matches.iter().take(limit) {
            if let Some(details) = self.get_symbol_details(symbol).await? {
                results.push(details);
            }
        }

        Ok(results)
    }

    /// Gets symbols by exchange
    pub async fn get_symbols_by_exchange(&self, exchange: &str, limit: usize) -> Result<Vec<String>, ApiError> {
        let mut conn = self.redis.get_connection().await?;

        let symbols: Vec<String> = conn.smembers(format!("symbols:exchange:{}", exchange)).await?;

        Ok(symbols.into_iter().take(limit).collect())
    }

    /// Gets symbols by asset type
    pub async fn get_symbols_by_asset_type(&self, asset_type: &str, limit: usize) -> Result<Vec<String>, ApiError> {
        let mut conn = self.redis.get_connection().await?;

        let symbols: Vec<String> = conn.smembers(format!("symbols:assetType:{}", asset_type)).await?;

        Ok(symbols.into_iter().take(limit).collect())
    }

    /// Loads Upstox NSE symbols into Redis
    pub async fn load_upstox_symbols_into_redis(&self) -> Result<usize, ApiError> {
        info!("Loading Upstox NSE symbols into Redis");

        // Get the Upstox API key from environment
        let api_key = std::env::var("UPSTOX_API_KEY")
            .unwrap_or_else(|_| "demo_api_key".to_string());

        // Create the Upstox symbols service
        let upstox_symbols_service = UpstoxSymbolsService::new(api_key);

        // Fetch NSE symbols from Upstox
        let nse_symbols = match upstox_symbols_service.fetch_nse_symbols().await {
            Ok(symbols) => {
                info!("Successfully fetched {} NSE symbols from Upstox", symbols.len());
                symbols
            },
            Err(e) => {
                info!("Failed to fetch NSE symbols from Upstox API: {}, using mock data", e);
                // Fall back to mock data if API fails
                UpstoxSymbolsService::get_mock_nse_symbols()
            }
        };

        if nse_symbols.is_empty() {
            info!("No NSE symbols found from Upstox, skipping");
            return Ok(0);
        }

        let mut pipe = redis::pipe();
        let mut counter = 0;
        let start_score = 1_000_000; // Start with a high score for consistent scoring

        // Process each symbol
        for symbol in nse_symbols {
            // Create a SymbolRecord for consistent format
            let record = SymbolRecord {
                ticker: symbol.symbol.clone(),
                exchange: symbol.exchange.clone(),
                asset_type: match symbol.asset_type {
                    AssetType::Stock => "STOCK".to_string(),
                    AssetType::Etf => "ETF".to_string(),
                    AssetType::Index => "INDEX".to_string(),
                    AssetType::Other => "OTHER".to_string(),
                },
                price_currency: "INR".to_string(),
                start_date: None,
                end_date: None,
            };

            // Store as hash
            pipe.hset_multiple(
                format!("symbols:data:{}", record.ticker),
                &[
                    ("exchange", record.exchange.clone()),
                    ("assetType", record.asset_type.clone()),
                    ("priceCurrency", record.price_currency.clone()),
                    ("startDate", record.start_date.clone().unwrap_or_default()),
                    ("endDate", record.end_date.clone().unwrap_or_default()),
                ],
            );

            // Add to sorted set for search (using ticker as score for alphabetical sorting)
            // Use a high starting score for consistent scoring
            pipe.zadd("symbols:all", record.ticker.clone(), (start_score + counter) as f64);

            // Add to sets for filtering
            pipe.sadd(format!("symbols:exchange:{}", record.exchange), record.ticker.clone());
            pipe.sadd(format!("symbols:assetType:{}", record.asset_type), record.ticker.clone());

            // Add to currency sets
            pipe.sadd(format!("symbols:currency:{}", record.price_currency), record.ticker.clone());

            counter += 1;

            // Execute in batches to avoid huge pipelines
            if counter % 1000 == 0 {
                pipe.query_async::<_, ()>(&mut self.redis.get_connection().await?)
                    .await?;

                pipe = redis::pipe();
                debug!("Loaded {} Upstox NSE symbols into Redis", counter);
            }
        }

        // Execute remaining commands
        pipe.query_async::<_, ()>(&mut self.redis.get_connection().await?)
            .await?;

        // Update the last updated timestamp
        let mut conn = self.redis.get_connection().await?;
        let now = chrono::Utc::now().timestamp();
        conn.set::<_, _, ()>("symbols:last_updated", now).await?;

        // Set expiration if TTL is specified
        if self.cache_ttl_days > 0 {
            let ttl_seconds = self.cache_ttl_days * 24 * 60 * 60;
            conn.expire::<_, ()>("symbols:last_updated", (ttl_seconds).try_into().unwrap()).await?;
        }

        info!("Successfully loaded {} Upstox NSE symbols into Redis", counter);
        Ok(counter)
    }

    /// Refreshes the symbol cache by reloading from the CSV file and Upstox
    pub async fn refresh_cache(&self) -> Result<usize, ApiError> {
        info!("Refreshing symbol cache");

        // Delete existing keys
        let mut conn = self.redis.get_connection().await?;

        // Get all keys with the symbols: prefix
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg("symbols:*")
            .query_async(&mut conn)
            .await?;

        if !keys.is_empty() {
            redis::cmd("DEL")
                .arg(keys)
                .query_async::<_, ()>(&mut conn)
                .await?;
        }
        
        // Load Upstox NSE symbols only
        let upstox_count = self.load_upstox_symbols_into_redis().await?;
        
        info!("Refreshed symbol cache with {} Upstox NSE symbols", upstox_count);
            
        Ok(upstox_count)
    }

    /// Gets the last updated timestamp for the symbol cache
    pub async fn get_last_updated(&self) -> Result<Option<i64>, ApiError> {
        let mut conn = self.redis.get_connection().await?;
        let timestamp: Option<i64> = conn.get("symbols:last_updated").await?;

        Ok(timestamp)
    }
}