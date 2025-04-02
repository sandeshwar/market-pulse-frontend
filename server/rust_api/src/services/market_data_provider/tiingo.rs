use crate::models::symbol::SymbolPrice;
use crate::models::market_index::MarketIndex;
use crate::models::error::ApiError;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use reqwest::Client;
use std::time::Duration;

/// Tiingo API client for market data
pub struct TiingoClient {
    client: Client,
    api_key: String,
    base_url: String,
}
/// Response structure for Tiingo EOD data
#[derive(Debug, Serialize, Deserialize)]
struct TiingoEodResponse {
    date: Option<DateTime<Utc>>,
    close: f64,
    high: Option<f64>,
    low: Option<f64>,
    open: Option<f64>,
    volume: Option<u64>,
    #[serde(rename = "adjClose")]
    adj_close: Option<f64>,
    #[serde(rename = "adjHigh")]
    adj_high: Option<f64>,
    #[serde(rename = "adjLow")]
    adj_low: Option<f64>,
    #[serde(rename = "adjOpen")]
    adj_open: Option<f64>,
    #[serde(rename = "adjVolume")]
    adj_volume: Option<u64>,
    #[serde(rename = "divCash")]
    div_cash: Option<f64>,
    #[serde(rename = "splitFactor")]
    split_factor: Option<f64>,
}

/// Response structure for Tiingo IEX data (real-time)
#[derive(Debug, Serialize, Deserialize)]
#[allow(non_snake_case)]
struct TiingoIexResponse {
    ticker: String,
    timestamp: DateTime<Utc>,
    quoteTimestamp: Option<DateTime<Utc>>,
    lastSaleTimestamp: Option<DateTime<Utc>>,
    last: Option<f64>,
    lastSize: Option<u64>,
    tngoLast: Option<f64>,
    prevClose: Option<f64>,
    open: Option<f64>,
    high: Option<f64>,
    low: Option<f64>,
    mid: Option<f64>,
    volume: Option<u64>,
    bidSize: Option<u64>,
    bidPrice: Option<f64>,
    askSize: Option<u64>,
    askPrice: Option<f64>,
}

/// Response structure for Tiingo Meta data
#[derive(Debug, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct TiingoMetaResponse {
    pub ticker: String,
    pub name: String,
    pub description: Option<String>,
    pub startDate: Option<String>,
    pub endDate: Option<String>,
    pub exchangeCode: Option<String>,
}

impl TiingoClient {
    /// Creates a new Tiingo API client
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_key,
            base_url: "https://api.tiingo.com".to_string(),
        }
    }

    /// Fetches market data for a list of symbols
    pub async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError> {
        if symbols.is_empty() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();

        // Process each symbol individually
        for symbol in symbols {
            // Clean the symbol (Tiingo doesn't use exchange suffixes)
            let clean_symbol = self.clean_symbol(symbol);
            
            // Try to get real-time data first (IEX)
            match self.fetch_iex_data(&clean_symbol).await {
                Ok(Some(price)) => {
                    results.push(price);
                },
                Ok(None) => {
                    // Fall back to EOD data if IEX data is not available
                    match self.fetch_eod_data(&clean_symbol).await {
                        Ok(Some(price)) => {
                            results.push(price);
                        },
                        Ok(None) => {
                            tracing::warn!("No data available for symbol: {}", symbol);
                        },
                        Err(e) => {
                            tracing::error!("Error fetching EOD data for {}: {}", symbol, e);
                        }
                    }
                },
                Err(e) => {
                    tracing::error!("Error fetching IEX data for {}: {}", symbol, e);
                    
                    // Try EOD data as fallback
                    match self.fetch_eod_data(&clean_symbol).await {
                        Ok(Some(price)) => {
                            results.push(price);
                        },
                        Ok(None) => {
                            tracing::warn!("No data available for symbol: {}", symbol);
                        },
                        Err(e2) => {
                            tracing::error!("Error fetching EOD data for {}: {}", symbol, e2);
                        }
                    }
                }
            }
        }

        Ok(results)
    }

    /// Fetches real-time IEX data for a symbol
    async fn fetch_iex_data(&self, symbol: &str) -> Result<Option<SymbolPrice>, ApiError> {
        let url = format!("{}/iex/{}", self.base_url, symbol);
        
        let response = self.client.get(&url)
            .query(&[("token", &self.api_key)])
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Tiingo API request failed: {}", e)))?;
        
        // Check if the request was successful
        if !response.status().is_success() {
            if response.status().as_u16() == 404 {
                // Symbol not found, return None
                return Ok(None);
            }
            
            let status = response.status();
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            return Err(ApiError::ExternalServiceError(
                format!("Tiingo API returned error status {}: {}", status, error_text)
            ));
        }
        
        // Parse the response
        let iex_data: Vec<TiingoIexResponse> = response.json().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Tiingo API response: {}", e)))?;
        
        if iex_data.is_empty() {
            return Ok(None);
        }
        
        let data = &iex_data[0];

        // Check if we have a valid last price
        let last_price = match data.last {
            Some(price) => price,
            None => {
                // If last price is null, try to use tngoLast or fall back to EOD data
                match data.tngoLast {
                    Some(price) => price,
                    None => {
                        // No valid price data available in IEX response
                        tracing::debug!("No valid price data in IEX response for {}", symbol);
                        return Ok(None);
                    }
                }
            }
        };

        // Calculate change and percent change
        let prev_close = data.prevClose.unwrap_or_else(|| last_price);
        let change = last_price - prev_close;
        let percent_change = if prev_close != 0.0 {
            (change / prev_close) * 100.0
        } else {
            0.0
        };

        // Create additional data map
        let mut additional_data = HashMap::new();
        if let Some(open) = data.open {
            additional_data.insert("openPrice".to_string(), serde_json::to_value(open).unwrap_or_default());
        }
        if let Some(high) = data.high {
            additional_data.insert("highPrice".to_string(), serde_json::to_value(high).unwrap_or_default());
        }
        if let Some(low) = data.low {
            additional_data.insert("lowPrice".to_string(), serde_json::to_value(low).unwrap_or_default());
        }
        if let Some(prev) = data.prevClose {
            additional_data.insert("closePrice".to_string(), serde_json::to_value(prev).unwrap_or_default());
        }
        if let Some(bid) = data.bidPrice {
            additional_data.insert("bidPrice".to_string(), serde_json::to_value(bid).unwrap_or_default());
        }
        if let Some(ask) = data.askPrice {
            additional_data.insert("askPrice".to_string(), serde_json::to_value(ask).unwrap_or_default());
        }

        // Create the symbol price object
        let symbol_price = SymbolPrice {
            symbol: self.format_output_symbol(symbol),
            price: last_price,
            change,
            percent_change,
            volume: data.volume.unwrap_or(0),
            timestamp: Some(data.timestamp),
            additional_data,
        };
        
        Ok(Some(symbol_price))
    }

    /// Fetches end-of-day data for a symbol
    async fn fetch_eod_data(&self, symbol: &str) -> Result<Option<SymbolPrice>, ApiError> {
        let url = format!("{}/tiingo/daily/{}/prices", self.base_url, symbol);
        
        let response = self.client.get(&url)
            .query(&[
                ("token", &self.api_key),
                ("startDate", &Utc::now().format("%Y-%m-%d").to_string()),
                ("endDate", &Utc::now().format("%Y-%m-%d").to_string()),
            ])
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Tiingo API request failed: {}", e)))?;
        
        // Check if the request was successful
        if !response.status().is_success() {
            if response.status().as_u16() == 404 {
                // Symbol not found, return None
                return Ok(None);
            }
            
            let status = response.status();
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            return Err(ApiError::ExternalServiceError(
                format!("Tiingo API returned error status {}: {}", status, error_text)
            ));
        }
        
        // Parse the response
        let eod_data: Vec<TiingoEodResponse> = response.json().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Tiingo API response: {}", e)))?;
        
        if eod_data.is_empty() {
            // Try to get the previous day's data
            return self.fetch_previous_eod_data(symbol).await;
        }
        
        let data = &eod_data[0];
        
        // Get the previous day's close for calculating change
        let prev_close = match self.fetch_previous_close(symbol).await {
            Ok(Some(close)) => close,
            _ => data.close, // If we can't get previous close, use current close (no change)
        };
        
        // Calculate change and percent change
        let change = data.close - prev_close;
        let percent_change = if prev_close != 0.0 {
            (change / prev_close) * 100.0
        } else {
            0.0
        };
        
        // Create additional data map
        let mut additional_data = HashMap::new();
        if let Some(open) = data.open {
            additional_data.insert("openPrice".to_string(), serde_json::to_value(open).unwrap_or_default());
        }
        if let Some(high) = data.high {
            additional_data.insert("highPrice".to_string(), serde_json::to_value(high).unwrap_or_default());
        }
        if let Some(low) = data.low {
            additional_data.insert("lowPrice".to_string(), serde_json::to_value(low).unwrap_or_default());
        }
        additional_data.insert("closePrice".to_string(), serde_json::to_value(prev_close).unwrap_or_default());
        
        // Create the symbol price object
        let symbol_price = SymbolPrice {
            symbol: self.format_output_symbol(symbol),
            price: data.close,
            change,
            percent_change,
            volume: data.volume.unwrap_or(0),
            timestamp: data.date,
            additional_data,
        };
        
        Ok(Some(symbol_price))
    }

    /// Fetches the previous day's EOD data
    async fn fetch_previous_eod_data(&self, symbol: &str) -> Result<Option<SymbolPrice>, ApiError> {
        // Calculate yesterday's date
        let yesterday = (Utc::now() - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
        let day_before = (Utc::now() - chrono::Duration::days(2)).format("%Y-%m-%d").to_string();
        
        let url = format!("{}/tiingo/daily/{}/prices", self.base_url, symbol);
        
        let response = self.client.get(&url)
            .query(&[
                ("token", &self.api_key),
                ("startDate", &day_before),
                ("endDate", &yesterday),
            ])
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Tiingo API request failed: {}", e)))?;
        
        // Check if the request was successful
        if !response.status().is_success() {
            if response.status().as_u16() == 404 {
                // Symbol not found, return None
                return Ok(None);
            }
            
            let status = response.status();
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            return Err(ApiError::ExternalServiceError(
                format!("Tiingo API returned error status {}: {}", status, error_text)
            ));
        }
        
        // Parse the response
        let eod_data: Vec<TiingoEodResponse> = response.json().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Tiingo API response: {}", e)))?;
        
        if eod_data.is_empty() {
            return Ok(None);
        }
        
        // Get the most recent data point
        let data = &eod_data[eod_data.len() - 1];
        
        // For previous data, we don't have a reference point for change calculation
        // So we'll set change and percent_change to 0
        
        // Create additional data map
        let mut additional_data = HashMap::new();
        if let Some(open) = data.open {
            additional_data.insert("openPrice".to_string(), serde_json::to_value(open).unwrap_or_default());
        }
        if let Some(high) = data.high {
            additional_data.insert("highPrice".to_string(), serde_json::to_value(high).unwrap_or_default());
        }
        if let Some(low) = data.low {
            additional_data.insert("lowPrice".to_string(), serde_json::to_value(low).unwrap_or_default());
        }
        
        // Create the symbol price object
        let symbol_price = SymbolPrice {
            symbol: self.format_output_symbol(symbol),
            price: data.close,
            change: 0.0,
            percent_change: 0.0,
            volume: data.volume.unwrap_or(0),
            timestamp: data.date,
            additional_data,
        };
        
        Ok(Some(symbol_price))
    }

    /// Fetches the previous day's closing price
    async fn fetch_previous_close(&self, symbol: &str) -> Result<Option<f64>, ApiError> {
        // Calculate yesterday's date
        let yesterday = (Utc::now() - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
        let day_before = (Utc::now() - chrono::Duration::days(2)).format("%Y-%m-%d").to_string();
        
        let url = format!("{}/tiingo/daily/{}/prices", self.base_url, symbol);
        
        let response = self.client.get(&url)
            .query(&[
                ("token", &self.api_key),
                ("startDate", &day_before),
                ("endDate", &yesterday),
            ])
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Tiingo API request failed: {}", e)))?;
        
        // Check if the request was successful
        if !response.status().is_success() {
            return Ok(None);
        }
        
        // Parse the response
        let eod_data: Vec<TiingoEodResponse> = response.json().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Tiingo API response: {}", e)))?;
        
        if eod_data.is_empty() {
            return Ok(None);
        }
        
        // Get the most recent data point
        let data = &eod_data[eod_data.len() - 1];
        
        Ok(Some(data.close))
    }

    /// Tiingo doesn't support market indices directly
    ///
    /// This method is intentionally removed as Tiingo doesn't provide market index data.
    /// Use dedicated market index providers like WsjMarketIndexProvider or GoogleMarketIndexProvider instead.
    pub async fn fetch_market_indices(&self, _indices: &[String]) -> Result<Vec<MarketIndex>, ApiError> {
        tracing::warn!("Tiingo does not support market indices directly. Use a dedicated market index provider instead.");

        // Return an empty vector since Tiingo can't provide this data
        Ok(Vec::new())
    }

    /// Fetches metadata for a symbol
    pub async fn fetch_metadata(&self, symbol: &str) -> Result<Option<TiingoMetaResponse>, ApiError> {
        let clean_symbol = self.clean_symbol(symbol);
        let url = format!("{}/tiingo/daily/{}", self.base_url, clean_symbol);
        
        let response = self.client.get(&url)
            .query(&[("token", &self.api_key)])
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Tiingo API request failed: {}", e)))?;
        
        // Check if the request was successful
        if !response.status().is_success() {
            if response.status().as_u16() == 404 {
                // Symbol not found, return None
                return Ok(None);
            }
            
            let status = response.status();
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            
            return Err(ApiError::ExternalServiceError(
                format!("Tiingo API returned error status {}: {}", status, error_text)
            ));
        }
        
        // Parse the response
        let meta: TiingoMetaResponse = response.json().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Tiingo API response: {}", e)))?;
        
        Ok(Some(meta))
    }

    /// Cleans a symbol for use with Tiingo API
    ///
    /// According to Tiingo's documentation:
    /// - They use hyphens ("-") instead of periods (".") for share classes
    /// - They don't use forward slashes for currencies
    /// - They have specific formats for preferred shares
    fn clean_symbol(&self, symbol: &str) -> String {
        // First, handle any exchange suffixes
        if let Some(idx) = symbol.find('.') {
            let exchange = &symbol[idx+1..];

            // For US symbols, Tiingo doesn't use the exchange suffix
            if exchange == "US" {
                return symbol[0..idx].to_string();
            }

            // For other exchanges, convert to Tiingo's format (using hyphens instead of periods)
            // Example: "BRK.A" becomes "BRK-A" in Tiingo
            return symbol.replace('.', "-");
        }

        // Handle any forward slashes (for currencies)
        if symbol.contains('/') {
            return symbol.replace('/', "");
        }

        // No special characters, return as is
        symbol.to_string()
    }

    /// Formats a symbol for output, adding exchange information
    fn format_output_symbol(&self, symbol: &str) -> String {
        // For simplicity, we'll assume US exchange if not specified
        if symbol.contains('.') {
            symbol.to_string()
        } else {
            format!("{}.US", symbol)
        }
    }

    /// Gets a display name for an index or ETF
    fn get_index_name(&self, symbol: &str) -> String {
        // First check if this is an ETF proxy we recognize
        match symbol.to_uppercase().as_str() {
            "SPY" => "S&P 500 ETF".to_string(),
            "QQQ" => "NASDAQ-100 ETF".to_string(),
            "DIA" => "Dow Jones Industrial Average ETF".to_string(),
            "IWM" => "Russell 2000 ETF".to_string(),
            "VTI" => "Total Stock Market ETF".to_string(),
            // Map ETF proxies back to their index names
            _ => {
                // Try to find a reverse mapping from ETF to index
                let index_symbol = match symbol.to_uppercase().as_str() {
                    "SPY" => "SPX",
                    "QQQ" => "NDX",
                    "DIA" => "DJI",
                    "IWM" => "RUT",
                    _ => symbol,
                };

                // Check if we have a display name for this index
                if let Some(name) = crate::config::market_indices::get_index_display_name(index_symbol) {
                    name
                } else {
                    format!("{} Index", symbol)
                }
            }
        }
    }
}