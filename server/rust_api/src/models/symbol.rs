use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Represents a stock or financial instrument symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    /// Unique ticker symbol (e.g., "AAPL")
    pub symbol: String,
    
    /// Full name of the company or instrument (e.g., "Apple Inc.")
    pub name: String,
    
    /// Exchange where the symbol is traded (e.g., "NASDAQ")
    pub exchange: String,
    
    /// Type of asset (e.g., "STOCK", "ETF", "INDEX")
    pub asset_type: AssetType,
}

/// Represents the type of financial asset
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum AssetType {
    Stock,
    Etf,
    Index,
    #[serde(other)]
    Other,
}

/// Collection of symbols with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolCollection {
    /// Timestamp when the collection was last updated
    pub timestamp: DateTime<Utc>,
    
    /// List of symbols in the collection
    pub symbols: Vec<Symbol>,
}

/// Response structure for symbol search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolSearchResponse {
    /// List of symbols matching the search criteria
    pub results: Vec<Symbol>,
}

/// Price data for a specific symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolPrice {
    /// Ticker symbol
    pub symbol: String,
    
    /// Current price
    pub price: f64,
    
    /// Change in price
    pub change: f64,
    
    /// Percentage change
    pub percent_change: f64,
    
    /// Trading volume
    pub volume: u64,
    
    /// Timestamp of the price data
    pub timestamp: DateTime<Utc>,
    
    /// Additional data fields that might be available
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub additional_data: HashMap<String, serde_json::Value>,
}

/// Represents a collection of price data for multiple symbols
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchPriceResponse {
    /// Map of symbol to price data
    pub prices: HashMap<String, SymbolPrice>,
    
    /// Timestamp when the data was retrieved
    pub timestamp: DateTime<Utc>,
}

impl Symbol {
    /// Creates a new Symbol instance
    pub fn new(
        symbol: String, 
        name: String, 
        exchange: String, 
        asset_type: AssetType
    ) -> Self {
        Self {
            symbol,
            name,
            exchange,
            asset_type,
            sector: None,
            industry: None,
        }
    }
    
    /// Creates a new Symbol with sector and industry information
    pub fn with_classification(
        symbol: String, 
        name: String, 
        exchange: String, 
        asset_type: AssetType,
        sector: String,
        industry: String
    ) -> Self {
        Self {
            symbol,
            name,
            exchange,
            asset_type,
            sector: Some(sector),
            industry: Some(industry),
        }
    }
}

impl SymbolCollection {
    /// Creates a new empty symbol collection
    pub fn new() -> Self {
        Self {
            timestamp: Utc::now(),
            symbols: Vec::new(),
        }
    }
    
    /// Creates a symbol collection with the provided symbols
    pub fn with_symbols(symbols: Vec<Symbol>) -> Self {
        Self {
            timestamp: Utc::now(),
            symbols,
        }
    }
    
    /// Adds a symbol to the collection
    pub fn add_symbol(&mut self, symbol: Symbol) {
        self.symbols.push(symbol);
        self.timestamp = Utc::now();
    }
    
    /// Searches for symbols matching the query in either symbol or name
    pub fn search(&self, query: &str, limit: usize) -> Vec<Symbol> {
        let query = query.to_uppercase();
        self.symbols
            .iter()
            .filter(|s| {
                s.symbol.contains(&query) || 
                s.name.to_uppercase().contains(&query)
            })
            .take(limit)
            .cloned()
            .collect()
    }
}