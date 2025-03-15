use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc, NaiveTime};
use std::collections::HashMap;

/// Represents a market index (e.g., S&P 500, Dow Jones)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketIndex {
    /// Unique identifier for the index (e.g., "SPX", "DJI")
    pub symbol: String,
    
    /// Full name of the index (e.g., "S&P 500", "Dow Jones Industrial Average")
    pub name: String,
    
    /// Current value of the index
    pub value: f64,
    
    /// Change in value since previous close
    pub change: f64,
    
    /// Percentage change since previous close
    pub percent_change: f64,
    
    /// Market status (open, closed, etc.)
    pub status: MarketStatus,
    
    /// Timestamp of the index data
    pub timestamp: DateTime<Utc>,
}

/// Represents the current status of a market
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MarketStatus {
    Open,
    Closed,
    PreMarket,
    AfterHours,
    Holiday,
}

/// Represents the trading hours for a market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketHours {
    /// Regular trading hours open time (in local market time)
    pub open: NaiveTime,
    
    /// Regular trading hours close time (in local market time)
    pub close: NaiveTime,
    
    /// Pre-market trading start time (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_market_open: Option<NaiveTime>,
    
    /// After-hours trading end time (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub after_hours_close: Option<NaiveTime>,
    
    /// Time zone identifier (e.g., "America/New_York")
    pub timezone: String,
}

/// Collection of market indices with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketIndicesCollection {
    /// Map of index symbols to their data
    pub indices: HashMap<String, MarketIndex>,
    
    /// Timestamp when the collection was last updated
    pub timestamp: DateTime<Utc>,
}

/// Configuration for market indices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketIndicesConfig {
    /// Map of index symbols to their display names
    pub indices: HashMap<String, String>,
    
    /// Map of index symbols to their trading hours
    pub market_hours: HashMap<String, MarketHours>,
}

impl MarketIndex {
    /// Creates a new MarketIndex instance
    pub fn new(
        symbol: String,
        name: String,
        value: f64,
        change: f64,
        percent_change: f64,
        status: MarketStatus,
    ) -> Self {
        Self {
            symbol,
            name,
            value,
            change,
            percent_change,
            status,
            timestamp: Utc::now(),
        }
    }
    
    /// Determines if the index is currently showing positive performance
    pub fn is_positive(&self) -> bool {
        self.change >= 0.0
    }
}

impl MarketIndicesCollection {
    /// Creates a new empty market indices collection
    pub fn new() -> Self {
        Self {
            indices: HashMap::new(),
            timestamp: Utc::now(),
        }
    }
    
    /// Adds or updates an index in the collection
    pub fn upsert_index(&mut self, index: MarketIndex) {
        self.indices.insert(index.symbol.clone(), index);
        self.timestamp = Utc::now();
    }
    
    /// Gets an index by its symbol
    pub fn get_index(&self, symbol: &str) -> Option<&MarketIndex> {
        self.indices.get(symbol)
    }
}