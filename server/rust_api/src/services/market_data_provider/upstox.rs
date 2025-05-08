use crate::models::symbol::SymbolPrice;
use crate::models::error::ApiError;
use serde::{Serialize, Deserialize};
use chrono::Utc;
use std::collections::HashMap;
use reqwest::Client;
use std::time::Duration;
use futures_util::future;
use serde_json;

/// Upstox API client for market data
#[derive(Clone)]
pub struct UpstoxClient {
    client: Client,
    api_key: String,
    base_url: String,
}

/// Response structure for Upstox LTP data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpstoxLtpResponse {
    pub status: String,
    pub data: HashMap<String, UpstoxLtpData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpstoxLtpData {
    pub last_price: f64,
    pub instrument_token: String,
}

/// Response structure for Upstox OHLC data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpstoxOhlcResponse {
    pub status: String,
    pub data: HashMap<String, UpstoxOhlcData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpstoxOhlcData {
    pub ohlc: UpstoxOhlc,
    pub last_price: f64,
    pub instrument_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpstoxOhlc {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
}

impl UpstoxClient {
    /// Creates a new Upstox API client
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_key,
            base_url: "https://api.upstox.com/v2".to_string(),
        }
    }

    /// Fetches market data for a list of symbols
    pub async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError> {
        if symbols.is_empty() {
            return Ok(Vec::new());
        }

        // Create a vector of futures for parallel processing
        let futures = symbols.iter().map(|symbol| {
            // Clone the symbol to own it inside the future
            let symbol_owned = symbol.clone();
            // Move the owned symbol into the async block
            async move {
                self.fetch_symbol_price(&symbol_owned).await
            }
        }).collect::<Vec<_>>();

        // Execute all futures in parallel
        let results = future::join_all(futures).await;

        // Collect successful results
        let mut prices = Vec::new();
        for result in results {
            match result {
                Ok(Some(price)) => prices.push(price),
                Ok(None) => {}, // Symbol not found, skip
                Err(e) => {
                    tracing::error!("Error fetching symbol price: {}", e);
                    // Continue with other symbols
                }
            }
        }

        Ok(prices)
    }

    /// Fetches price data for a single symbol
    async fn fetch_symbol_price(&self, symbol: &str) -> Result<Option<SymbolPrice>, ApiError> {
        // For NSE stocks, we need to convert the symbol to the Upstox instrument_key format
        // Based on Upstox API documentation and testing, the correct format is "NSE_EQ|INE002A01018"
        // If we don't have the ISIN code, we need to use the format that Upstox expects
        
        // First, check if the symbol already has the correct format with a pipe
        let instrument_key = if symbol.contains('|') {
            tracing::debug!("Symbol already has pipe format: {}", symbol);
            symbol.to_string()
        } 
        // If it has a colon format (NSE_EQ:RELIANCE), convert it to the expected format
        else if symbol.contains(':') {
            let parts: Vec<&str> = symbol.split(':').collect();
            if parts.len() == 2 {
                // Try to use the exchange prefix with the symbol
                let key = format!("{}|{}", parts[0], parts[1]);
                tracing::debug!("Converted colon format to pipe format: {} -> {}", symbol, key);
                key
            } else {
                // If the format is unexpected, use the original symbol
                tracing::debug!("Unexpected colon format, using original: {}", symbol);
                symbol.to_string()
            }
        } 
        // If it's just a plain symbol, assume it's an NSE equity
        else {
            let key = format!("NSE_EQ|{}", symbol);
            tracing::debug!("Using default NSE_EQ format for symbol: {} -> {}", symbol, key);
            key
        };
        
        tracing::info!("Using instrument key: {} for symbol: {}", instrument_key, symbol);

        // Try to fetch LTP data first
        match self.fetch_ltp_data(&instrument_key).await {
            Ok(Some(price_data)) => {
                let mut additional_data = HashMap::new();
                additional_data.insert("exchange".to_string(), serde_json::Value::String("NSE".to_string()));
                
                return Ok(Some(SymbolPrice {
                    symbol: symbol.to_string(),
                    price: price_data.last_price,
                    change: 0.0, // LTP doesn't provide change
                    percent_change: 0.0, // LTP doesn't provide change percent
                    volume: 0, // LTP doesn't provide volume
                    timestamp: Some(Utc::now()),
                    additional_data,
                }));
            }
            Ok(None) => {
                tracing::warn!("No LTP data found for symbol: {}", symbol);
            }
            Err(e) => {
                tracing::error!("Error fetching LTP data for {}: {}", symbol, e);
                // Continue to try OHLC data
            }
        }

        // If LTP fails, try OHLC data
        match self.fetch_ohlc_data(&instrument_key).await {
            Ok(Some(ohlc_data)) => {
                let mut additional_data = HashMap::new();
                additional_data.insert("exchange".to_string(), serde_json::Value::String("NSE".to_string()));
                additional_data.insert("open".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(ohlc_data.ohlc.open).unwrap()));
                additional_data.insert("high".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(ohlc_data.ohlc.high).unwrap()));
                additional_data.insert("low".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(ohlc_data.ohlc.low).unwrap()));
                additional_data.insert("close".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(ohlc_data.ohlc.close).unwrap()));
                additional_data.insert("prev_close".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(ohlc_data.ohlc.close).unwrap()));
                
                return Ok(Some(SymbolPrice {
                    symbol: symbol.to_string(),
                    price: ohlc_data.last_price,
                    change: ohlc_data.last_price - ohlc_data.ohlc.close, // Calculate change
                    percent_change: ((ohlc_data.last_price - ohlc_data.ohlc.close) / ohlc_data.ohlc.close) * 100.0, // Calculate change percent
                    volume: 0, // OHLC doesn't provide volume
                    timestamp: Some(Utc::now()),
                    additional_data,
                }));
            }
            Ok(None) => {
                tracing::warn!("No OHLC data found for symbol: {}", symbol);
                return Ok(None);
            }
            Err(e) => {
                tracing::error!("Error fetching OHLC data for {}: {}", symbol, e);
                return Err(e);
            }
        }
    }

    /// Fetches LTP data for a symbol
    async fn fetch_ltp_data(&self, instrument_key: &str) -> Result<Option<UpstoxLtpData>, ApiError> {
        tracing::debug!("Fetching LTP data for instrument key: {}", instrument_key);
        let url = format!("{}/market-quote/ltp?instrument_key={}", self.base_url, instrument_key);
        tracing::debug!("LTP URL: {}", url);
        
        let response = self.client.get(&url)
            .header("Accept", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Upstox API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            
            if status.as_u16() == 404 {
                return Ok(None); // Symbol not found
            }
            
            // Check for authentication errors (401 Unauthorized)
            if status.as_u16() == 401 {
                tracing::error!("Upstox API authentication error: Token may have expired. Please update the UPSTOX_API_KEY in .env file.");
                return Err(ApiError::ExternalServiceError(
                    format!("Upstox API authentication error: Token may have expired. Please update the UPSTOX_API_KEY in .env file. Error: {}", error_text)
                ));
            }
            
            return Err(ApiError::ExternalServiceError(
                format!("Upstox API error: {} - {}", status, error_text)
            ));
        }

        // Get the response body as text first for logging
        let response_text = response.text().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to get Upstox LTP response text: {}", e)))?;
        
        tracing::debug!("LTP Response: {}", response_text);
        
        let ltp_response: UpstoxLtpResponse = serde_json::from_str(&response_text)
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Upstox LTP response: {}", e)))?;

        // The response might use a different format for the key in the data map
        // It could be using "NSE_EQ:RELIANCE" format even though we sent "NSE_EQ|INE002A01018"
        
        // First try the exact instrument key
        if let Some(data) = ltp_response.data.get(instrument_key) {
            return Ok(Some(data.clone()));
        }
        
        // If not found, try alternative formats
        // Try replacing pipe with colon
        if instrument_key.contains('|') {
            let alt_key = instrument_key.replace('|', ":");
            if let Some(data) = ltp_response.data.get(&alt_key) {
                return Ok(Some(data.clone()));
            }
        }
        
        // If still not found, try extracting just the symbol part
        if instrument_key.contains('|') || instrument_key.contains(':') {
            let parts: Vec<&str> = if instrument_key.contains('|') {
                instrument_key.split('|').collect()
            } else {
                instrument_key.split(':').collect()
            };
            
            if parts.len() > 1 {
                // Try with just the symbol part
                if let Some(data) = ltp_response.data.iter().find(|(k, _)| k.ends_with(parts[1])) {
                    return Ok(Some(data.1.clone()));
                }
            }
        }
        
        // If we've tried all formats and still can't find the data, return None
        tracing::warn!("Could not find LTP data for instrument key: {} in response", instrument_key);
        Ok(None)
    }

    /// Fetches OHLC data for a symbol
    async fn fetch_ohlc_data(&self, instrument_key: &str) -> Result<Option<UpstoxOhlcData>, ApiError> {
        tracing::debug!("Fetching OHLC data for instrument key: {}", instrument_key);
        // Add the required interval parameter (1d = 1 day)
        let url = format!("{}/market-quote/ohlc?instrument_key={}&interval=1d", self.base_url, instrument_key);
        tracing::debug!("OHLC URL: {}", url);
        
        let response = self.client.get(&url)
            .header("Accept", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Upstox API request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            
            if status.as_u16() == 404 {
                return Ok(None); // Symbol not found
            }
            
            // Check for authentication errors (401 Unauthorized)
            if status.as_u16() == 401 {
                tracing::error!("Upstox API authentication error: Token may have expired. Please update the UPSTOX_API_KEY in .env file.");
                return Err(ApiError::ExternalServiceError(
                    format!("Upstox API authentication error: Token may have expired. Please update the UPSTOX_API_KEY in .env file. Error: {}", error_text)
                ));
            }
            
            return Err(ApiError::ExternalServiceError(
                format!("Upstox API error: {} - {}", status, error_text)
            ));
        }

        // Get the response body as text first for logging
        let response_text = response.text().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to get Upstox OHLC response text: {}", e)))?;
        
        tracing::debug!("OHLC Response: {}", response_text);
        
        let ohlc_response: UpstoxOhlcResponse = serde_json::from_str(&response_text)
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Upstox OHLC response: {}", e)))?;

        // The response might use a different format for the key in the data map
        // It could be using "NSE_EQ:RELIANCE" format even though we sent "NSE_EQ|INE002A01018"
        
        // First try the exact instrument key
        if let Some(data) = ohlc_response.data.get(instrument_key) {
            return Ok(Some(data.clone()));
        }
        
        // If not found, try alternative formats
        // Try replacing pipe with colon
        if instrument_key.contains('|') {
            let alt_key = instrument_key.replace('|', ":");
            if let Some(data) = ohlc_response.data.get(&alt_key) {
                return Ok(Some(data.clone()));
            }
        }
        
        // If still not found, try extracting just the symbol part
        if instrument_key.contains('|') || instrument_key.contains(':') {
            let parts: Vec<&str> = if instrument_key.contains('|') {
                instrument_key.split('|').collect()
            } else {
                instrument_key.split(':').collect()
            };
            
            if parts.len() > 1 {
                // Try with just the symbol part
                if let Some(data) = ohlc_response.data.iter().find(|(k, _)| k.ends_with(parts[1])) {
                    return Ok(Some(data.1.clone()));
                }
            }
        }
        
        // If we've tried all formats and still can't find the data, return None
        tracing::warn!("Could not find OHLC data for instrument key: {} in response", instrument_key);
        Ok(None)
    }

    /// Cleans a symbol by removing exchange prefixes if present
    fn clean_symbol(&self, symbol: &str) -> String {
        if symbol.contains(':') {
            let parts: Vec<&str> = symbol.split(':').collect();
            if parts.len() > 1 {
                return parts[1].to_string();
            }
        }
        symbol.to_string()
    }
}