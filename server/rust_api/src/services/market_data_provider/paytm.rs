use crate::models::symbol::SymbolPrice;
use crate::models::market_index::MarketIndex;
use crate::models::error::ApiError;
use serde::{Serialize, Deserialize};
use chrono::Utc;
use std::collections::HashMap;
use reqwest::Client;
use std::time::Duration;

/// Paytm Money API client for market data
pub struct PaytmMoneyClient {
    client: Client,
    api_key: String,
    access_token: String,
    #[allow(dead_code)]
    public_access_token: String,
    base_url: String,
}

/// Request structure for Paytm Money live market data API
#[derive(Debug, Serialize, Deserialize)]
struct LiveMarketDataRequest {
    mode: String,
    preferences: Vec<MarketDataPreference>,
}

/// Market data preference for Paytm Money API
#[derive(Debug, Serialize, Deserialize)]
struct MarketDataPreference {
    #[serde(rename = "exchangeType")]
    exchange_type: String,

    #[serde(rename = "scripType")]
    scrip_type: String,

    #[serde(rename = "scripId")]
    scrip_id: String,
}

/// Response structure for Paytm Money live market data API
#[derive(Debug, Serialize, Deserialize)]
struct LiveMarketDataResponse {
    #[serde(rename = "serverTime")]
    server_time: Option<String>,

    #[serde(rename = "msgId")]
    msg_id: Option<String>,

    #[serde(rename = "statusMessage")]
    status_message: Option<String>,

    status: String,

    data: Vec<LiveMarketData>,
}

/// Market data structure from Paytm Money API
#[derive(Debug, Serialize, Deserialize)]
struct LiveMarketData {
    #[serde(rename = "scripId")]
    scrip_id: String,

    #[serde(rename = "exchangeType")]
    exchange_type: String,

    #[serde(rename = "scripType")]
    scrip_type: String,

    #[serde(rename = "lastPrice")]
    last_price: f64,

    #[serde(rename = "lastQuantity")]
    last_quantity: Option<u64>,

    #[serde(rename = "avgPrice")]
    avg_price: Option<f64>,

    #[serde(rename = "totalBuyQty")]
    total_buy_qty: Option<u64>,

    #[serde(rename = "totalSellQty")]
    total_sell_qty: Option<u64>,

    #[serde(rename = "openPrice")]
    open_price: Option<f64>,

    #[serde(rename = "highPrice")]
    high_price: Option<f64>,

    #[serde(rename = "lowPrice")]
    low_price: Option<f64>,

    #[serde(rename = "closePrice")]
    close_price: Option<f64>,

    #[serde(rename = "totalTradedQty")]
    total_traded_qty: Option<u64>,

    #[serde(rename = "totalTradedValue")]
    total_traded_value: Option<f64>,

    #[serde(rename = "change")]
    change: Option<f64>,

    #[serde(rename = "pChange")]
    percent_change: Option<f64>,

    #[serde(rename = "lastUpdateTime")]
    last_update_time: Option<String>,

    // Additional fields that might be available
    #[serde(flatten)]
    additional_data: HashMap<String, serde_json::Value>,
}

impl PaytmMoneyClient {
    /// Creates a new Paytm Money API client
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_key,
            access_token: String::new(),
            public_access_token: String::new(),
            base_url: "https://developer.paytmmoney.com/api/v1".to_string(),
        }
    }

    /// Sets the access token for authenticated requests
    pub fn set_access_token(&mut self, access_token: String, public_access_token: String) {
        self.access_token = access_token;
        self.public_access_token = public_access_token;
    }

    /// Fetches market data for a list of symbols
    pub async fn fetch_market_data(&self, symbols: &[String]) -> Result<Vec<SymbolPrice>, ApiError> {
        if symbols.is_empty() {
            return Ok(Vec::new());
        }

        // Create preferences for each symbol
        let mut preferences = Vec::new();
        for symbol in symbols {
            // Parse the symbol to determine exchange and scrip type
            let (exchange_type, scrip_type, scrip_id) = parse_symbol(symbol);

            preferences.push(MarketDataPreference {
                exchange_type,
                scrip_type,
                scrip_id,
            });
        }

        // Create the request body
        let request = LiveMarketDataRequest {
            mode: "FULL".to_string(), // Get full market data
            preferences,
        };

        // Build the request URL
        let url = format!("{}/market-data/live", self.base_url);

        // Make the API request
        let response = self.client.post(&url)
            .header("x-api-key", &self.api_key)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .json(&request)
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Paytm API request failed: {}", e)))?;

        // Check if the request was successful
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());

            return Err(ApiError::ExternalServiceError(
                format!("Paytm API returned error status {}: {}", status, error_text)
            ));
        }

        // Parse the response
        let paytm_response: LiveMarketDataResponse = response.json().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Paytm API response: {}", e)))?;

        if paytm_response.status != "success" {
            return Err(ApiError::ExternalServiceError(
                format!("Paytm API returned error status: {}", paytm_response.status_message.unwrap_or_default())
            ));
        }

        // Convert Paytm data to our model
        let symbol_prices: Vec<SymbolPrice> = paytm_response.data.into_iter()
            .map(|data| {
                // Construct the symbol from the response data
                let symbol = format!("{}.{}", data.scrip_id, data.exchange_type);

                let mut additional_data = data.additional_data;

                // Add some fields to additional data
                if let Some(open) = data.open_price {
                    if let Ok(value) = serde_json::to_value(open) {
                        additional_data.insert("openPrice".to_string(), value);
                    }
                }
                if let Some(high) = data.high_price {
                    if let Ok(value) = serde_json::to_value(high) {
                        additional_data.insert("highPrice".to_string(), value);
                    }
                }
                if let Some(low) = data.low_price {
                    if let Ok(value) = serde_json::to_value(low) {
                        additional_data.insert("lowPrice".to_string(), value);
                    }
                }
                if let Some(close) = data.close_price {
                    if let Ok(value) = serde_json::to_value(close) {
                        additional_data.insert("closePrice".to_string(), value);
                    }
                }

                SymbolPrice {
                    symbol,
                    price: data.last_price,
                    change: data.change.unwrap_or(0.0),
                    percent_change: data.percent_change.unwrap_or(0.0),
                    volume: data.total_traded_qty.unwrap_or(0),
                    timestamp: Some(Utc::now()),
                    additional_data,
                }
            })
            .collect();

        Ok(symbol_prices)
    }

    /// Fetches market index data
    pub async fn fetch_market_indices(&self, indices: &[String]) -> Result<Vec<MarketIndex>, ApiError> {
        if indices.is_empty() {
            return Ok(Vec::new());
        }

        // Create preferences for each index
        let mut preferences = Vec::new();
        for index in indices {
            // For indices, we use a different scrip type
            let (exchange_type, _, scrip_id) = parse_symbol(index);

            preferences.push(MarketDataPreference {
                exchange_type,
                scrip_type: "INDEX".to_string(),
                scrip_id,
            });
        }

        // Create the request body
        let request = LiveMarketDataRequest {
            mode: "FULL".to_string(), // Get full market data
            preferences,
        };

        // Build the request URL
        let url = format!("{}/market-data/live", self.base_url);

        // Make the API request
        let response = self.client.post(&url)
            .header("x-api-key", &self.api_key)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .json(&request)
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Paytm API request failed: {}", e)))?;

        // Check if the request was successful
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());

            return Err(ApiError::ExternalServiceError(
                format!("Paytm API returned error status {}: {}", status, error_text)
            ));
        }

        // Parse the response
        let paytm_response: LiveMarketDataResponse = response.json().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse Paytm API response: {}", e)))?;

        if paytm_response.status != "success" {
            return Err(ApiError::ExternalServiceError(
                format!("Paytm API returned error status: {}", paytm_response.status_message.unwrap_or_default())
            ));
        }

        // Convert Paytm data to our model
        let indices: Vec<MarketIndex> = paytm_response.data.into_iter()
            .map(|data| {
                // Construct the symbol and name from the response data
                let symbol = format!("{}.{}", data.scrip_id, data.exchange_type);
                let name = format!("{} {}", data.exchange_type, data.scrip_id);

                MarketIndex {
                    symbol,
                    name,
                    value: data.last_price,
                    change: data.change.unwrap_or(0.0),
                    percent_change: data.percent_change.unwrap_or(0.0),
                    status: crate::models::market_index::MarketStatus::Open, // Default to Open, can be refined later
                    timestamp: Some(Utc::now()),
                }
            })
            .collect();

        Ok(indices)
    }
}

/// Helper function to parse a symbol into exchange, scrip type, and scrip id
fn parse_symbol(symbol: &str) -> (String, String, String) {
    // Default values
    let mut exchange_type = "NSE".to_string();
    let mut scrip_type = "EQUITY".to_string();
    let mut scrip_id = symbol.to_string();

    // Check if the symbol contains a dot (exchange separator)
    if let Some(idx) = symbol.find('.') {
        scrip_id = symbol[0..idx].to_string();
        let exch = &symbol[idx+1..];

        if exch.eq_ignore_ascii_case("NSE") {
            exchange_type = "NSE".to_string();
        } else if exch.eq_ignore_ascii_case("BSE") {
            exchange_type = "BSE".to_string();
        }
    }

    // Determine scrip type based on symbol characteristics
    if symbol.contains("NIFTY") || symbol.contains("SENSEX") {
        scrip_type = "INDEX".to_string();
    } else if symbol.contains("ETF") {
        scrip_type = "ETF".to_string();
    }

    (exchange_type, scrip_type, scrip_id)
}