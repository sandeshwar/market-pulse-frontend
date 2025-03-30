use crate::models::symbol::{Symbol, SymbolCollection, AssetType};
use crate::models::error::ApiError;
use crate::services::redis::RedisManager;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::path::Path;
use csv::Reader;
use std::fs::File;
use std::io::BufReader;
use chrono::Utc;

/// Service for managing symbols
#[derive(Clone)]
pub struct SymbolService {
    symbols: Arc<RwLock<SymbolCollection>>,
    redis: RedisManager,
}

impl SymbolService {
    /// Creates a new symbol service
    pub async fn new() -> Self {
        let redis = RedisManager::new()
            .expect("Failed to create Redis manager");

        let service = Self {
            symbols: Arc::new(RwLock::new(SymbolCollection::new())),
            redis,
        };

        // Initialize the symbol cache
        if let Err(e) = service.initialize_cache().await {
            tracing::error!("Failed to initialize symbol cache: {}", e);
        }

        service
    }

    /// Initializes the symbol cache from Redis or CSV
    async fn initialize_cache(&self) -> Result<(), ApiError> {
        // Clear Redis cache to avoid deserialization issues during development
        if let Err(e) = self.redis.delete("symbols").await {
            tracing::warn!("Failed to clear Redis symbols cache: {}", e);
        }

        // Try to load from Redis first
        match self.redis.get::<SymbolCollection>("symbols").await {
            Ok(Some(collection)) => {
                tracing::info!("Loaded {} symbols from Redis cache", collection.symbols.len());
                let mut symbols = self.symbols.write().await;
                *symbols = collection;
                return Ok(());
            }
            Ok(None) => {
                tracing::info!("No symbols found in Redis cache, loading from CSV");
            }
            Err(e) => {
                tracing::error!("Error loading symbols from Redis: {}", e);
            }
        }

        // If Redis failed or had no data, load from CSV
        self.load_symbols_from_csv().await?;

        // Save to Redis for future use
        let symbols = self.symbols.read().await;
        if let Err(e) = self.redis.set("symbols", &*symbols, Some(86400)).await {
            tracing::error!("Failed to save symbols to Redis: {}", e);
        }

        Ok(())
    }
    
    /// Loads symbols from the CSV file
    async fn load_symbols_from_csv(&self) -> Result<(), ApiError> {
        // Use the correct path relative to the server directory
        let csv_path = Path::new("../data/symbols.csv");

        let file = File::open(csv_path)
            .map_err(|e| ApiError::InternalError(format!("Failed to open symbols CSV: {}", e)))?;
        
        let reader = BufReader::new(file);
        let mut csv_reader = Reader::from_reader(reader);
        
        let mut symbols = Vec::new();
        
        for result in csv_reader.records() {
            let record = result
                .map_err(|e| ApiError::InternalError(format!("Failed to read CSV record: {}", e)))?;
            
            if record.len() >= 4 {
                let symbol = record.get(0).unwrap_or("").to_string();
                let name = record.get(1).unwrap_or("").to_string();
                let exchange = record.get(2).unwrap_or("").to_string();
                let asset_type_str = record.get(3).unwrap_or("").to_string();
                
                // Skip empty records
                if symbol.is_empty() || name.is_empty() {
                    continue;
                }
                
                // Parse asset type
                let asset_type = match asset_type_str.to_uppercase().as_str() {
                    "STOCK" => AssetType::Stock,
                    "ETF" => AssetType::Etf,
                    "INDEX" => AssetType::Index,
                    _ => AssetType::Other,
                };
                
                // Create symbol and add to collection
                let symbol = Symbol::new(symbol, name, exchange, asset_type);
                symbols.push(symbol);
            }
        }
        
        tracing::info!("Loaded {} symbols from CSV", symbols.len());
        
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
    
    /// Updates the symbol cache
    pub async fn update_cache(&self) -> Result<(), ApiError> {
        tracing::info!("Updating symbol cache");
        self.load_symbols_from_csv().await?;
        
        // Save to Redis
        let symbols = self.symbols.read().await;
        if let Err(e) = self.redis.set("symbols", &*symbols, Some(86400)).await {
            tracing::error!("Failed to save updated symbols to Redis: {}", e);
        }
        
        Ok(())
    }
}