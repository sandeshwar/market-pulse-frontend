use crate::models::symbol::{Symbol, SymbolCollection, AssetType};
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
use crate::services::upstox_symbols::UpstoxSymbolsService;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::path::{Path, PathBuf};
use csv::{Reader, Writer};
use std::fs::{File, create_dir_all};
use std::io::{BufReader, Cursor, Write};
use chrono::{Utc, DateTime};
use reqwest::Client;
use std::time::Duration;
use zip::ZipArchive;
use tokio::time::interval;
use std::collections::HashSet;

/// Directory for storing downloaded data
const DATA_DIR: &str = "../data";
/// Key for tracking when symbols were last updated
const SYMBOLS_LAST_UPDATE_KEY: &str = "symbols:last_update";

/// Service for managing symbols
#[derive(Clone)]
pub struct SymbolService {
    symbols: Arc<RwLock<SymbolCollection>>,
    redis: RedisManager,
    http_client: Client,
    update_interval_hours: u64,
}

impl SymbolService {
    /// Creates a new symbol service
    pub async fn new() -> Self {
        let redis = RedisManager::new()
            .expect("Failed to create Redis manager");

        // Create HTTP client with reasonable timeout
        let http_client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        // Default update interval is 24 hours
        let update_interval_hours = std::env::var("SYMBOLS_UPDATE_INTERVAL_HOURS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(24);

        let service = Self {
            symbols: Arc::new(RwLock::new(SymbolCollection::new())),
            redis,
            http_client,
            update_interval_hours,
        };

        // Initialize the symbol cache
        if let Err(e) = service.initialize_cache().await {
            tracing::error!("Failed to initialize symbol cache: {}", e);
        }

        // Start the background updater in a separate thread
        // We'll use a blocking task to avoid Send issues with the zip crate
        let service_clone = service.clone();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
            rt.block_on(async {
                service_clone.start_background_updater().await;
            });
        });

        service
    }

    /// Starts the background updater for symbols
    async fn start_background_updater(&self) {
        let interval_duration = Duration::from_secs(self.update_interval_hours * 3600);
        let mut interval_timer = interval(interval_duration);
        
        tracing::info!("Starting Upstox symbols background updater with interval of {} hours", self.update_interval_hours);

        loop {
            interval_timer.tick().await;
            
            tracing::info!("Running scheduled Upstox symbols update");
            if let Err(e) = self.fetch_and_merge_upstox_symbols().await {
                tracing::error!("Failed to update Upstox symbols: {}", e);
            } else {
                tracing::info!("Successfully updated Upstox symbols");
                
                // Update the last update timestamp
                let now = Utc::now().timestamp();
                if let Err(e) = self.redis.set(SYMBOLS_LAST_UPDATE_KEY, &now, None).await {
                    tracing::error!("Failed to save symbols last update timestamp: {}", e);
                }
            }
        }
    }

    /// Initializes the symbol cache from Redis or directly from Upstox
    async fn initialize_cache(&self) -> Result<(), ApiError> {
        // Try to load from Redis first (chunked approach)
        if let Ok(Some(chunk_count)) = self.redis.get::<usize>("symbols_chunk_count").await {
            if let Ok(Some(total_count)) = self.redis.get::<usize>("symbols_count").await {
                tracing::info!("Found {} symbol chunks in Redis with total of {} symbols", chunk_count, total_count);

                // Get the timestamp
                let timestamp = self.redis.get::<Option<DateTime<Utc>>>("symbols_timestamp").await
                    .unwrap_or(None).flatten().or_else(|| Some(Utc::now()));

                // Load all chunks
                let mut all_symbols = Vec::with_capacity(total_count);

                for i in 0..chunk_count {
                    let chunk_key = format!("symbols_chunk_{}", i);
                    match self.redis.get::<Vec<Symbol>>(&chunk_key).await {
                        Ok(Some(chunk)) => {
                            tracing::debug!("Loaded chunk {} with {} symbols", i, chunk.len());
                            all_symbols.extend(chunk);
                        }
                        Ok(None) => {
                            tracing::warn!("Missing chunk {} in Redis", i);
                        }
                        Err(e) => {
                            tracing::error!("Error loading chunk {} from Redis: {}", i, e);
                        }
                    }
                }

                if !all_symbols.is_empty() {
                    tracing::info!("Successfully loaded {} symbols from Redis chunks", all_symbols.len());

                    // Update the symbol collection
                    let mut symbols = self.symbols.write().await;
                    *symbols = SymbolCollection {
                        timestamp,
                        symbols: all_symbols,
                    };

                    // Check if we need to update Upstox symbols
                    self.check_and_update_upstox_symbols().await?;

                    return Ok(());
                }
            }
        }

        // Try the old method as fallback
        match self.redis.get::<SymbolCollection>("symbols").await {
            Ok(Some(collection)) => {
                tracing::info!("Loaded {} symbols from Redis cache (legacy format)", collection.symbols.len());
                let mut symbols = self.symbols.write().await;
                *symbols = collection;

                // Check if we need to update Upstox symbols
                self.check_and_update_upstox_symbols().await?;

                return Ok(());
            }
            Ok(None) => {
                tracing::info!("No symbols found in Redis cache");
            }
            Err(e) => {
                tracing::error!("Error loading symbols from Redis: {}", e);
            }
        }
        
        // Directly fetch Upstox symbols
        tracing::info!("Fetching Upstox symbols");
        if let Err(e) = self.fetch_and_merge_upstox_symbols().await {
            tracing::error!("Failed to fetch and merge Upstox NSE symbols during initialization: {}", e);
            
            // If Upstox fails, load from CSV as a fallback
            self.load_symbols_from_csv().await?;
        } else {
            tracing::info!("Successfully loaded symbols from Upstox");
        }

        // Save to Redis for future use
        let symbols = self.symbols.read().await;
        if let Err(e) = self.redis.set("symbols", &*symbols, Some(86400)).await {
            tracing::error!("Failed to save symbols to Redis: {}", e);
        }

        Ok(())
    }

    /// Checks if we need to update Upstox symbols and does so if needed
    async fn check_and_update_upstox_symbols(&self) -> Result<(), ApiError> {
        // Check when we last updated the symbols
        let last_update = match self.redis.get::<i64>(SYMBOLS_LAST_UPDATE_KEY).await {
            Ok(Some(timestamp)) => timestamp,
            _ => 0, // If no timestamp or error, assume we need to update
        };

        let now = Utc::now().timestamp();
        let update_interval_secs = self.update_interval_hours as i64 * 3600;
        
        // Check if we need to update Upstox NSE symbols
        if now - last_update > (update_interval_secs / 2) {
            tracing::info!("Checking for Upstox NSE symbols updates");
            if let Err(e) = self.fetch_and_merge_upstox_symbols().await {
                tracing::error!("Failed to fetch and merge Upstox NSE symbols during periodic check: {}", e);
            }
            
            // Update the last update timestamp
            if let Err(e) = self.redis.set(SYMBOLS_LAST_UPDATE_KEY, &now, None).await {
                tracing::error!("Failed to save symbols last update timestamp: {}", e);
            }
        }

        Ok(())
    }
    
    /// Loads symbols from the CSV file
    async fn load_symbols_from_csv(&self) -> Result<(), ApiError> {
        // Use the fallback symbols CSV file
        let fallback_path = Path::new("../data/symbols.csv");
        let csv_path = fallback_path;

        let file = File::open(csv_path)
            .map_err(|e| ApiError::InternalError(format!("Failed to open symbols CSV at {}: {}",
                csv_path.display(), e)))?;

        let reader = BufReader::new(file);
        let mut csv_reader = Reader::from_reader(reader);

        let mut symbols = Vec::new();

        for result in csv_reader.records() {
            let record = result
                .map_err(|e| ApiError::InternalError(format!("Failed to read CSV record: {}", e)))?;

            // Handle different CSV formats
            if record.len() >= 2 {
                let symbol = record.get(0).unwrap_or("").trim().to_string();
                let name = record.get(1).unwrap_or("").trim().to_string();

                // Skip empty records
                if symbol.is_empty() || name.is_empty() {
                    continue;
                }

                // Default values
                let mut exchange = "US".to_string();
                let mut asset_type = AssetType::Stock;

                // If we have exchange and asset type columns
                if record.len() >= 4 {
                    exchange = record.get(2).unwrap_or("US").trim().to_string();
                    let asset_type_str = record.get(3).unwrap_or("STOCK").trim().to_string();

                    // Parse asset type
                    asset_type = match asset_type_str.to_uppercase().as_str() {
                        "STOCK" => AssetType::Stock,
                        "ETF" => AssetType::Etf,
                        "INDEX" => AssetType::Index,
                        _ => AssetType::Other,
                    };
                } else if name.to_uppercase().contains("ETF") {
                    // If we don't have explicit asset type but name contains ETF
                    asset_type = AssetType::Etf;
                }

                // Create symbol and add to collection
                let symbol = Symbol::new(symbol, name, exchange, asset_type);
                symbols.push(symbol);
            }
        }

        tracing::info!("Loaded {} symbols from CSV at {}", symbols.len(), csv_path.display());

        // Update the symbol collection
        let mut symbol_collection = self.symbols.write().await;
        *symbol_collection = SymbolCollection {
            timestamp: Some(Utc::now()),
            symbols,
        };

        Ok(())
    }
    
    /// Searches for symbols matching the query
    pub async fn search_symbols(&self, query: &str, limit: usize) -> Result<Vec<Symbol>, ApiError> {
        if query.len() < 2 {
            return Ok(Vec::new());
        }
        
        // Get the current symbols from memory
        let symbols = self.symbols.read().await;
        let mut results = symbols.search(query, limit);
        
        // If we don't have enough results, try to fetch Upstox symbols directly
        if results.len() < limit {
            tracing::info!("Searching for Upstox symbols for query: {}", query);
            
            // Get the Upstox API key from environment
            let api_key = std::env::var("UPSTOX_API_KEY")
                .unwrap_or_else(|_| "demo_api_key".to_string());
            
            // Create the Upstox symbols service
            let upstox_symbols_service = crate::services::upstox_symbols::UpstoxSymbolsService::new(api_key);
            
            // Fetch NSE symbols from Upstox
            match upstox_symbols_service.fetch_nse_symbols().await {
                Ok(upstox_symbols) => {
                    tracing::info!("Successfully fetched {} NSE symbols from Upstox for search", upstox_symbols.len());
                    
                    // Filter the Upstox symbols based on the query
                    let query_upper = query.to_uppercase();
                    let upstox_results: Vec<Symbol> = upstox_symbols.into_iter()
                        .filter(|s| {
                            s.symbol.contains(&query_upper) ||
                            s.name.to_uppercase().contains(&query_upper)
                        })
                        .take(limit - results.len())
                        .collect();
                    
                    // Add the filtered Upstox symbols to the results
                    if !upstox_results.is_empty() {
                        tracing::info!("Found {} matching Upstox symbols for query: {}", upstox_results.len(), query);
                        results.extend(upstox_results);
                    }
                },
                Err(e) => {
                    tracing::warn!("Failed to fetch NSE symbols from Upstox API for search: {}", e);
                    // Try to use mock data as fallback
                    let mock_symbols = crate::services::upstox_symbols::UpstoxSymbolsService::get_mock_nse_symbols();
                    
                    // Filter the mock symbols based on the query
                    let query_upper = query.to_uppercase();
                    let mock_results: Vec<Symbol> = mock_symbols.into_iter()
                        .filter(|s| {
                            s.symbol.contains(&query_upper) ||
                            s.name.to_uppercase().contains(&query_upper)
                        })
                        .take(limit - results.len())
                        .collect();
                    
                    // Add the filtered mock symbols to the results
                    if !mock_results.is_empty() {
                        tracing::info!("Found {} matching mock Upstox symbols for query: {}", mock_results.len(), query);
                        results.extend(mock_results);
                    } else {
                        // Instead of hard-coding stocks, try to load from a cached file
                        tracing::info!("No mock symbols match, trying to load from cached NSE symbols file");
                        if let Ok(cached_symbols) = self.load_cached_nse_symbols().await {
                            let fallback_results: Vec<Symbol> = cached_symbols.into_iter()
                                .filter(|s| {
                                    s.symbol.contains(&query_upper) ||
                                    s.name.to_uppercase().contains(&query_upper)
                                })
                                .take(limit - results.len())
                                .collect();
                                
                            if !fallback_results.is_empty() {
                                tracing::info!("Found {} matching symbols from cached NSE file for query: {}", fallback_results.len(), query);
                                results.extend(fallback_results);
                            }
                        } else {
                            tracing::warn!("Could not load cached NSE symbols file, no fallback results available");
                        }
                    }
                }
            }
        }

        Ok(results)
    }

    /// Gets the total count of symbols in memory
    pub async fn get_symbols_count(&self) -> usize {
        let symbols = self.symbols.read().await;
        symbols.symbols.len()
    }

    /// Gets the total count of symbols stored in Redis
    pub async fn get_redis_symbols_count(&self) -> usize {
        // First try the chunked approach
        if let Ok(Some(count)) = self.redis.get::<usize>("symbols_count").await {
            return count;
        }

        // Fall back to the legacy approach
        if let Ok(Some(collection)) = self.redis.get::<SymbolCollection>("symbols").await {
            return collection.symbols.len();
        }

        // If neither approach works, return 0
        0
    }

    /// Gets symbols by range (start and end index)
    /// This is primarily for troubleshooting purposes
    pub async fn get_symbols_by_range(&self, start: usize, end: usize) -> Result<Vec<Symbol>, ApiError> {
        let symbols = self.symbols.read().await;
        let total = symbols.symbols.len();

        // Validate range
        if start >= total {
            return Err(ApiError::InvalidRequest(format!("Start index {} is out of range (total symbols: {})", start, total)));
        }

        // Clamp end to the total number of symbols
        let end = end.min(total);

        // Ensure start is less than end
        if start >= end {
            return Err(ApiError::InvalidRequest(format!("Start index {} must be less than end index {}", start, end)));
        }

        // Return the slice of symbols
        let result = symbols.symbols[start..end].to_vec();

        Ok(result)
    }

    /// Fetches NSE symbols from Upstox and merges them with existing symbols
    pub async fn fetch_and_merge_upstox_symbols(&self) -> Result<(), ApiError> {
        tracing::info!("Fetching and merging Upstox NSE symbols");

        // Get the Upstox API key from environment
        let api_key = std::env::var("UPSTOX_API_KEY")
            .unwrap_or_else(|_| "demo_api_key".to_string());

        // Create the Upstox symbols service
        let upstox_symbols_service = UpstoxSymbolsService::new(api_key);

        // Fetch NSE symbols from Upstox
        let nse_symbols = match upstox_symbols_service.fetch_nse_symbols().await {
            Ok(symbols) => {
                tracing::info!("Successfully fetched {} NSE symbols from Upstox", symbols.len());
                
                // Save the symbols to the cache file for future use
                if !symbols.is_empty() {
                    self.save_nse_symbols_to_cache(&symbols).await;
                }
                
                symbols
            },
            Err(e) => {
                tracing::warn!("Failed to fetch NSE symbols from Upstox API: {}, using mock data", e);
                // Fall back to mock data if API fails
                UpstoxSymbolsService::get_mock_nse_symbols()
            }
        };

        if nse_symbols.is_empty() {
            tracing::warn!("No NSE symbols found from Upstox, skipping merge");
            return Ok(());
        }

        // Get current symbols
        let mut symbol_collection = self.symbols.write().await;
        
        // Create a HashSet of existing symbol tickers for quick lookup
        let existing_tickers: HashSet<String> = symbol_collection.symbols
            .iter()
            .map(|s| s.symbol.clone())
            .collect();

        // Count before merging
        let count_before = symbol_collection.symbols.len();
        
        // Add NSE symbols that don't already exist
        let mut added_count = 0;
        for nse_symbol in nse_symbols {
            if !existing_tickers.contains(&nse_symbol.symbol) {
                symbol_collection.symbols.push(nse_symbol);
                added_count += 1;
            }
        }

        tracing::info!("Added {} new NSE symbols to the collection (total: {})", 
            added_count, symbol_collection.symbols.len());

        // Update the timestamp
        symbol_collection.timestamp = Some(Utc::now());

        // Store the final count for logging after we release the lock
        let final_count = symbol_collection.symbols.len();

        // Save the updated collection to Redis
        self.save_symbols_to_redis(&symbol_collection).await?;

        // Drop the mutable borrow before logging
        drop(symbol_collection);

        tracing::info!("Successfully merged and saved Upstox NSE symbols (before: {}, after: {})", 
            count_before, final_count);

        Ok(())
    }

    /// Saves the symbol collection to Redis in chunks
    async fn save_symbols_to_redis(&self, symbol_collection: &SymbolCollection) -> Result<(), ApiError> {
        let count = symbol_collection.symbols.len();

        tracing::info!("Saving {} symbols to Redis in chunks", count);

        // Store the total count
        if let Err(e) = self.redis.set("symbols_count", &count, Some(86400)).await {
            tracing::error!("Failed to save symbols count to Redis: {}", e);
        }

        // Store the timestamp
        let timestamp = symbol_collection.timestamp;
        if let Err(e) = self.redis.set("symbols_timestamp", &timestamp, Some(86400)).await {
            tracing::error!("Failed to save symbols timestamp to Redis: {}", e);
        }

        // Split into chunks of 5000 symbols each
        const CHUNK_SIZE: usize = 5000;
        let chunks = symbol_collection.symbols.chunks(CHUNK_SIZE);
        let chunk_count = (count + CHUNK_SIZE - 1) / CHUNK_SIZE; // Ceiling division

        tracing::info!("Splitting {} symbols into {} chunks of {} symbols each",
            count, chunk_count, CHUNK_SIZE);

        for (i, chunk) in chunks.enumerate() {
            let chunk_key = format!("symbols_chunk_{}", i);
            if let Err(e) = self.redis.set(&chunk_key, &chunk, Some(86400)).await {
                tracing::error!("Failed to save symbols chunk {} to Redis: {}", i, e);
            } else {
                tracing::debug!("Saved symbols chunk {} with {} symbols", i, chunk.len());
            }
        }

        // Store the number of chunks
        if let Err(e) = self.redis.set("symbols_chunk_count", &chunk_count, Some(86400)).await {
            tracing::error!("Failed to save symbols chunk count to Redis: {}", e);
        }

        Ok(())
    }

    /// Updates the symbol cache
    pub async fn update_cache(&self) -> Result<(), ApiError> {
        tracing::info!("Updating symbol cache");

        // Load symbols from CSV as a fallback
        if let Err(e) = self.load_symbols_from_csv().await {
            tracing::warn!("Failed to load symbols from CSV: {}", e);
        }

        // Try to fetch and merge Upstox NSE symbols
        if let Err(e) = self.fetch_and_merge_upstox_symbols().await {
            tracing::error!("Failed to fetch and merge Upstox NSE symbols: {}", e);
        }

        // Save to Redis using the chunked approach
        let symbol_collection = self.symbols.read().await;
        self.save_symbols_to_redis(&symbol_collection).await?;

        Ok(())
    }
    
    /// Loads NSE symbols from a cached file
    async fn load_cached_nse_symbols(&self) -> Result<Vec<Symbol>, ApiError> {
        // Define the path to the cached NSE symbols file
        let nse_cache_path = Path::new(DATA_DIR).join("nse_symbols_cache.json");
        
        // Check if the file exists
        if !nse_cache_path.exists() {
            // If not, try to create it by saving the mock symbols
            let mock_symbols = crate::services::upstox_symbols::UpstoxSymbolsService::get_mock_nse_symbols();
            
            // Ensure the data directory exists
            if let Err(e) = create_dir_all(DATA_DIR) {
                tracing::error!("Failed to create data directory: {}", e);
                return Err(ApiError::InternalError(format!("Failed to create data directory: {}", e)));
            }
            
            // Serialize the mock symbols to JSON
            let json = serde_json::to_string_pretty(&mock_symbols)
                .map_err(|e| ApiError::InternalError(format!("Failed to serialize NSE symbols: {}", e)))?;
                
            // Write the JSON to the file
            let mut file = File::create(&nse_cache_path)
                .map_err(|e| ApiError::InternalError(format!("Failed to create NSE symbols cache file: {}", e)))?;
                
            file.write_all(json.as_bytes())
                .map_err(|e| ApiError::InternalError(format!("Failed to write NSE symbols to cache file: {}", e)))?;
                
            tracing::info!("Created NSE symbols cache file with {} symbols", mock_symbols.len());
            
            return Ok(mock_symbols);
        }
        
        // If the file exists, read it
        let file = File::open(&nse_cache_path)
            .map_err(|e| ApiError::InternalError(format!("Failed to open NSE symbols cache file: {}", e)))?;
            
        // Parse the JSON
        let symbols: Vec<Symbol> = serde_json::from_reader(file)
            .map_err(|e| ApiError::InternalError(format!("Failed to parse NSE symbols cache file: {}", e)))?;
            
        tracing::info!("Loaded {} NSE symbols from cache file", symbols.len());
        
        Ok(symbols)
    }
    
    /// Saves NSE symbols to a cache file for future use
    async fn save_nse_symbols_to_cache(&self, symbols: &[Symbol]) -> bool {
        // Define the path to the cached NSE symbols file
        let nse_cache_path = Path::new(DATA_DIR).join("nse_symbols_cache.json");
        
        // Ensure the data directory exists
        if let Err(e) = create_dir_all(DATA_DIR) {
            tracing::error!("Failed to create data directory for NSE symbols cache: {}", e);
            return false;
        }
        
        // Serialize the symbols to JSON
        let json = match serde_json::to_string_pretty(symbols) {
            Ok(json) => json,
            Err(e) => {
                tracing::error!("Failed to serialize NSE symbols for cache: {}", e);
                return false;
            }
        };
        
        // Write the JSON to the file
        match File::create(&nse_cache_path) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(json.as_bytes()) {
                    tracing::error!("Failed to write NSE symbols to cache file: {}", e);
                    return false;
                }
            },
            Err(e) => {
                tracing::error!("Failed to create NSE symbols cache file: {}", e);
                return false;
            }
        }
        
        tracing::info!("Successfully saved {} NSE symbols to cache file", symbols.len());
        true
    }
}