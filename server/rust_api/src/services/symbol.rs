use crate::models::symbol::{Symbol, SymbolCollection, AssetType};
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
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

/// URL for Tiingo's supported tickers list
const TIINGO_SUPPORTED_TICKERS_URL: &str = "https://apimedia.tiingo.com/docs/tiingo/daily/supported_tickers.zip";

/// Redis key for storing the last update time of Tiingo symbols
const TIINGO_SYMBOLS_LAST_UPDATE_KEY: &str = "tiingo:symbols:last_update";

/// Directory for storing downloaded data
const DATA_DIR: &str = "../data";

/// Path for the downloaded Tiingo zip file
const TIINGO_ZIP_PATH: &str = "../data/tiingo_symbols.zip";

/// Path for the extracted Tiingo CSV file
const TIINGO_CSV_PATH: &str = "../data/tiingo_symbols.csv";

/// Path for the filtered Tiingo CSV file (stocks only)
const TIINGO_STOCKS_CSV_PATH: &str = "../data/tiingo_stocks.csv";

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
        let update_interval_hours = std::env::var("TIINGO_SYMBOLS_UPDATE_INTERVAL_HOURS")
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

    /// Starts the background updater for Tiingo symbols
    async fn start_background_updater(&self) {
        let interval_duration = Duration::from_secs(self.update_interval_hours * 3600);
        let mut interval_timer = interval(interval_duration);

        tracing::info!("Starting Tiingo symbols background updater with interval of {} hours", self.update_interval_hours);

        loop {
            interval_timer.tick().await;

            tracing::info!("Running scheduled Tiingo symbols update");
            match self.download_tiingo_symbols().await {
                Ok(_) => tracing::info!("Successfully updated Tiingo symbols"),
                Err(e) => tracing::error!("Failed to update Tiingo symbols: {}", e),
            }
        }
    }

    /// Initializes the symbol cache from Redis, Tiingo, or CSV
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

                    // Check if we need to update from Tiingo
                    self.check_and_update_tiingo_symbols().await?;

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

                // Check if we need to update from Tiingo
                self.check_and_update_tiingo_symbols().await?;

                return Ok(());
            }
            Ok(None) => {
                tracing::info!("No symbols found in Redis cache");
            }
            Err(e) => {
                tracing::error!("Error loading symbols from Redis: {}", e);
            }
        }

        // Try to download from Tiingo first
        match self.download_tiingo_symbols().await {
            Ok(true) => {
                tracing::info!("Successfully loaded symbols from Tiingo");
                return Ok(());
            }
            Ok(false) => {
                tracing::info!("No symbols downloaded from Tiingo, falling back to CSV");
            }
            Err(e) => {
                tracing::warn!("Failed to download symbols from Tiingo: {}, falling back to CSV", e);
            }
        }

        // If Tiingo failed, load from CSV as a fallback
        self.load_symbols_from_csv().await?;

        // Save to Redis for future use
        let symbols = self.symbols.read().await;
        if let Err(e) = self.redis.set("symbols", &*symbols, Some(86400)).await {
            tracing::error!("Failed to save symbols to Redis: {}", e);
        }

        Ok(())
    }

    /// Checks if we need to update Tiingo symbols and does so if needed
    async fn check_and_update_tiingo_symbols(&self) -> Result<(), ApiError> {
        // Check when we last updated the Tiingo symbols
        let last_update = match self.redis.get::<i64>(TIINGO_SYMBOLS_LAST_UPDATE_KEY).await {
            Ok(Some(timestamp)) => timestamp,
            _ => 0, // If no timestamp or error, assume we need to update
        };

        let now = Utc::now().timestamp();
        let update_interval_secs = self.update_interval_hours as i64 * 3600;

        // If it's been longer than our update interval, update the symbols
        if now - last_update > update_interval_secs {
            tracing::info!("Tiingo symbols are stale, updating from Tiingo API");
            match self.download_tiingo_symbols().await {
                Ok(_) => tracing::info!("Successfully updated Tiingo symbols"),
                Err(e) => tracing::error!("Failed to update Tiingo symbols: {}", e),
            }
        }

        Ok(())
    }
    
    /// Loads symbols from the CSV file
    async fn load_symbols_from_csv(&self) -> Result<(), ApiError> {
        // First try to load from the filtered Tiingo stocks CSV if it exists
        let tiingo_stocks_path = Path::new(TIINGO_STOCKS_CSV_PATH);
        let fallback_path = Path::new("../data/symbols.csv");

        // Determine which CSV file to use
        let csv_path = if tiingo_stocks_path.exists() {
            tracing::info!("Using filtered Tiingo stocks CSV file");
            tiingo_stocks_path
        } else if Path::new(TIINGO_CSV_PATH).exists() {
            tracing::info!("Using full Tiingo CSV file");
            Path::new(TIINGO_CSV_PATH)
        } else {
            tracing::info!("Using fallback symbols CSV file");
            fallback_path
        };

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

        let symbols = self.symbols.read().await;
        let results = symbols.search(query, limit);

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
    
    /// Downloads the latest supported tickers from Tiingo
    pub async fn download_tiingo_symbols(&self) -> Result<bool, ApiError> {
        tracing::info!("Downloading supported tickers from Tiingo");

        // Ensure data directory exists
        tokio::task::spawn_blocking(|| -> Result<(), ApiError> {
            create_dir_all(DATA_DIR)
                .map_err(|e| ApiError::InternalError(format!("Failed to create data directory: {}", e)))?;
            Ok(())
        }).await.map_err(|e| ApiError::InternalError(format!("Task join error: {}", e)))??;

        // Download the ZIP file
        let response = self.http_client.get(TIINGO_SUPPORTED_TICKERS_URL)
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to download Tiingo symbols: {}", e)))?;

        if !response.status().is_success() {
            return Err(ApiError::ExternalServiceError(
                format!("Failed to download Tiingo symbols: HTTP {}", response.status())
            ));
        }

        // Get the response bytes
        let bytes = response.bytes()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to read Tiingo symbols response: {}", e)))?;

        // Save the ZIP file locally
        tokio::task::spawn_blocking(move || -> Result<(), ApiError> {
            let mut file = File::create(TIINGO_ZIP_PATH)
                .map_err(|e| ApiError::InternalError(format!("Failed to create ZIP file: {}", e)))?;
            file.write_all(&bytes)
                .map_err(|e| ApiError::InternalError(format!("Failed to write ZIP file: {}", e)))?;
            tracing::info!("Saved Tiingo symbols ZIP file to {}", TIINGO_ZIP_PATH);
            Ok(())
        }).await.map_err(|e| ApiError::InternalError(format!("Task join error: {}", e)))??;

        // Extract the CSV and filter stocks in a blocking task
        let symbols = tokio::task::spawn_blocking(|| -> Result<Vec<Symbol>, ApiError> {
            // Open the ZIP file
            let file = File::open(TIINGO_ZIP_PATH)
                .map_err(|e| ApiError::InternalError(format!("Failed to open ZIP file: {}", e)))?;

            let mut archive = ZipArchive::new(file)
                .map_err(|e| ApiError::InternalError(format!("Failed to open Tiingo symbols ZIP: {}", e)))?;

            // Find the CSV file in the archive (should be named "supported_tickers.csv")
            let csv_file_name = (0..archive.len())
                .find_map(|i| {
                    if let Ok(file) = archive.by_index(i) {
                        if file.name().ends_with(".csv") {
                            return Some(file.name().to_string());
                        }
                    }
                    None
                })
                .ok_or_else(|| ApiError::InternalError("No CSV file found in Tiingo symbols ZIP".to_string()))?;

            // Extract the CSV file
            let mut csv_file = archive.by_name(&csv_file_name)
                .map_err(|e| ApiError::InternalError(format!("Failed to extract CSV from ZIP: {}", e)))?;

            // Save the extracted CSV file
            let mut output_file = File::create(TIINGO_CSV_PATH)
                .map_err(|e| ApiError::InternalError(format!("Failed to create CSV file: {}", e)))?;

            std::io::copy(&mut csv_file, &mut output_file)
                .map_err(|e| ApiError::InternalError(format!("Failed to write CSV file: {}", e)))?;

            tracing::info!("Extracted CSV file to {}", TIINGO_CSV_PATH);

            // Now read the CSV and filter for stocks only
            let csv_file = File::open(TIINGO_CSV_PATH)
                .map_err(|e| ApiError::InternalError(format!("Failed to open extracted CSV: {}", e)))?;

            let mut csv_reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(BufReader::new(csv_file));

            // Create a writer for the filtered CSV
            let stocks_file = File::create(TIINGO_STOCKS_CSV_PATH)
                .map_err(|e| ApiError::InternalError(format!("Failed to create stocks CSV file: {}", e)))?;

            let mut csv_writer = Writer::from_writer(stocks_file);

            // Write the header
            csv_writer.write_record(&["ticker", "name", "exchange", "assetType"])
                .map_err(|e| ApiError::InternalError(format!("Failed to write CSV header: {}", e)))?;

            // Parse the CSV into symbols and filter for stocks
            let mut symbols = Vec::new();
            let mut stock_count = 0;
            let mut total_count = 0;

            for result in csv_reader.records() {
                let record = result
                    .map_err(|e| ApiError::InternalError(format!("Failed to read Tiingo CSV record: {}", e)))?;

                total_count += 1;

                if record.len() < 2 {
                    continue;
                }

                let ticker = record.get(0).unwrap_or("").trim();
                let name = record.get(1).unwrap_or("").trim();

                // Skip empty records
                if ticker.is_empty() || name.is_empty() {
                    continue;
                }

                // Determine asset type (Tiingo mainly has stocks and ETFs)
                let is_etf = name.to_uppercase().contains("ETF");
                let asset_type = if is_etf {
                    AssetType::Etf
                } else {
                    AssetType::Stock
                };

                // Only include stocks in our filtered CSV
                if !is_etf {
                    // Write to the filtered CSV
                    csv_writer.write_record(&[
                        ticker,
                        name,
                        "US", // Default exchange
                        "STOCK" // Asset type
                    ]).map_err(|e| ApiError::InternalError(format!("Failed to write to stocks CSV: {}", e)))?;

                    stock_count += 1;
                }

                // Create symbol and add to collection
                // For exchange, we'll use "US" as default since Tiingo is primarily US-focused
                let symbol = Symbol::new(
                    ticker.to_string(),
                    name.to_string(),
                    "US".to_string(),
                    asset_type
                );

                symbols.push(symbol);
            }

            // Flush the writer to ensure all data is written
            csv_writer.flush()
                .map_err(|e| ApiError::InternalError(format!("Failed to flush stocks CSV: {}", e)))?;

            tracing::info!("Filtered {} stocks out of {} total symbols to {}",
                stock_count, total_count, TIINGO_STOCKS_CSV_PATH);

            Ok(symbols)
        }).await.map_err(|e| ApiError::InternalError(format!("Task join error: {}", e)))??;

        if symbols.is_empty() {
            tracing::warn!("No symbols found in Tiingo CSV");
            return Ok(false);
        }

        tracing::info!("Loaded {} symbols from Tiingo", symbols.len());

        // Update the symbol collection
        let mut symbol_collection = self.symbols.write().await;
        *symbol_collection = SymbolCollection {
            timestamp: Some(Utc::now()),
            symbols,
        };

        // Save to Redis in chunks to avoid memory issues
        // Redis has limits on string sizes, so we'll split the symbols into chunks
        tracing::info!("Saving {} symbols to Redis in chunks", symbol_collection.symbols.len());

        // First, clear any existing symbols
        if let Err(e) = self.redis.delete("symbols_count").await {
            tracing::warn!("Failed to clear Redis symbols count: {}", e);
        }

        // Store the total count
        let count = symbol_collection.symbols.len();
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

        // Update the last update timestamp
        let now = Utc::now().timestamp();
        if let Err(e) = self.redis.set(TIINGO_SYMBOLS_LAST_UPDATE_KEY, &now, None).await {
            tracing::error!("Failed to save Tiingo symbols last update timestamp: {}", e);
        }

        Ok(true)
    }

    /// Updates the symbol cache
    pub async fn update_cache(&self) -> Result<(), ApiError> {
        tracing::info!("Updating symbol cache");

        // Try to update from Tiingo first
        match self.download_tiingo_symbols().await {
            Ok(true) => {
                tracing::info!("Successfully updated symbols from Tiingo");
                return Ok(());
            }
            Ok(false) => {
                tracing::info!("No symbols downloaded from Tiingo, falling back to CSV");
            }
            Err(e) => {
                tracing::warn!("Failed to download symbols from Tiingo: {}, falling back to CSV", e);
            }
        }

        // If Tiingo failed, fall back to CSV
        self.load_symbols_from_csv().await?;

        // Save to Redis using the chunked approach
        let symbol_collection = self.symbols.read().await;
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
}