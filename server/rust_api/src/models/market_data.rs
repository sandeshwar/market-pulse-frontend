use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Represents a data point with timestamp and value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataPoint {
    /// Timestamp of the data point
    pub timestamp: DateTime<Utc>,
    
    /// Value at the given timestamp
    pub value: f64,
}

// NOTE: NOT IN USE AS OF NOW
/// Represents a time series of data points
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeries {
    /// Symbol this time series belongs to
    pub symbol: String,
    
    /// Interval between data points (e.g., "1min", "1day")
    pub interval: String,
    
    /// Series of data points
    pub data: Vec<DataPoint>,
    
    /// Timestamp when the time series was last updated
    pub last_updated: DateTime<Utc>,
}

/// Represents OHLCV (Open, High, Low, Close, Volume) data for a symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OhlcvData {
    /// Symbol this OHLCV data belongs to
    pub symbol: String,
    
    /// Timestamp of the data point
    pub timestamp: DateTime<Utc>,
    
    /// Opening price
    pub open: f64,
    
    /// Highest price during the period
    pub high: f64,
    
    /// Lowest price during the period
    pub low: f64,
    
    /// Closing price
    pub close: f64,
    
    /// Trading volume
    pub volume: u64,
}

/// Collection of OHLCV data points
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OhlcvSeries {
    /// Symbol this series belongs to
    pub symbol: String,
    
    /// Interval between data points (e.g., "1min", "1day")
    pub interval: String,
    
    /// Series of OHLCV data points
    pub data: Vec<OhlcvData>,
    
    /// Timestamp when the series was last updated
    pub last_updated: DateTime<Utc>,
}

/// Represents market data for multiple symbols
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketDataResponse {
    /// Map of symbol to its time series data
    pub time_series: HashMap<String, TimeSeries>, // NOTE: NOT IN USE AS OF NOW
    
    /// Map of symbol to its OHLCV data
    pub ohlcv: HashMap<String, OhlcvSeries>,
    
    /// Timestamp when the data was retrieved
    pub timestamp: DateTime<Utc>,
}

// NOTE: NOT IN USE AS OF NOW
/// Parameters for requesting historical market data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalDataRequest {
    /// Symbol to fetch data for
    pub symbol: String,
    
    /// Interval between data points (e.g., "1min", "5min", "1hour", "1day")
    pub interval: String,
    
    /// Start date/time for the data
    pub start_time: Option<DateTime<Utc>>,
    
    /// End date/time for the data
    pub end_time: Option<DateTime<Utc>>,
    
    /// Maximum number of data points to return
    pub limit: Option<usize>,
}

// NOTE: NOT IN USE AS OF NOW
impl TimeSeries {
    /// Creates a new empty time series for a symbol
    pub fn new(symbol: String, interval: String) -> Self {
        Self {
            symbol,
            interval,
            data: Vec::new(),
            last_updated: Utc::now(),
        }
    }
    
    /// Adds a data point to the time series
    pub fn add_point(&mut self, timestamp: DateTime<Utc>, value: f64) {
        self.data.push(DataPoint { timestamp, value });
        self.last_updated = Utc::now();
    }
    
    /// Gets the latest data point in the series
    pub fn latest_point(&self) -> Option<&DataPoint> {
        self.data.last()
    }
}

impl OhlcvSeries {
    /// Creates a new empty OHLCV series for a symbol
    pub fn new(symbol: String, interval: String) -> Self {
        Self {
            symbol,
            interval,
            data: Vec::new(),
            last_updated: Utc::now(),
        }
    }
    
    /// Adds an OHLCV data point to the series
    pub fn add_point(&mut self, ohlcv: OhlcvData) {
        self.data.push(ohlcv);
        self.last_updated = Utc::now();
    }
    
    /// Gets the latest OHLCV data point in the series
    pub fn latest_point(&self) -> Option<&OhlcvData> {
        self.data.last()
    }
}