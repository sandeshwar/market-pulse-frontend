use crate::models::symbol::{Symbol, AssetType};
use crate::models::error::ApiError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use std::collections::HashMap;
use std::io::{BufReader, Read};
use flate2::read::GzDecoder;
use csv::ReaderBuilder;

/// URL for Upstox's NSE symbols list (CSV format)
const UPSTOX_NSE_SYMBOLS_URL: &str = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.csv.gz";

/// Structure for Upstox instrument data from CSV
#[derive(Debug, Deserialize)]
pub struct UpstoxInstrumentCsv {
    #[serde(rename = "instrument_key")]
    pub instrument_key: String,
    #[serde(rename = "instrument_token")]
    pub instrument_token: String,
    #[serde(rename = "trading_symbol")]
    pub trading_symbol: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "last_price")]
    pub last_price: Option<String>,
    #[serde(rename = "expiry")]
    pub expiry: Option<String>,
    #[serde(rename = "strike")]
    pub strike: Option<String>,
    #[serde(rename = "tick_size")]
    pub tick_size: Option<String>,
    #[serde(rename = "lot_size")]
    pub lot_size: Option<String>,
    #[serde(rename = "instrument_type")]
    pub instrument_type: String,
    #[serde(rename = "option_type")]
    pub option_type: Option<String>,
    #[serde(rename = "exchange")]
    pub exchange: String,
}

/// Service for fetching and managing Upstox NSE symbols
pub struct UpstoxSymbolsService {
    client: Client,
    api_key: String,
}

impl UpstoxSymbolsService {
    /// Creates a new UpstoxSymbolsService
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_key,
        }
    }

    /// Fetches NSE symbols from Upstox API (CSV format)
    pub async fn fetch_nse_symbols(&self) -> Result<Vec<Symbol>, ApiError> {
        tracing::info!("Fetching NSE symbols from Upstox API (CSV format)");

        // Download the gzipped CSV file
        let response = self.client.get(UPSTOX_NSE_SYMBOLS_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to fetch NSE symbols from Upstox: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            
            // Check for authentication errors (401 Unauthorized)
            if status.as_u16() == 401 {
                tracing::error!("Upstox API authentication error: Token may have expired. Please update the UPSTOX_API_KEY in .env file.");
                return Err(ApiError::ExternalServiceError(
                    format!("Upstox API authentication error: Token may have expired. Please update the UPSTOX_API_KEY in .env file. Error: {}", error_text)
                ));
            }
            
            return Err(ApiError::ExternalServiceError(
                format!("Failed to fetch NSE symbols from Upstox: HTTP {} - {}", status, error_text)
            ));
        }

        // Get the response bytes
        let bytes = response.bytes()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to read NSE symbols response: {}", e)))?;

        // Decompress the gzipped content
        let gz_decoder = GzDecoder::new(&bytes[..]);
        let mut reader = BufReader::new(gz_decoder);
        
        // Read the CSV content
        let mut csv_content = String::new();
        reader.read_to_string(&mut csv_content)
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to decompress NSE symbols: {}", e)))?;

        // Parse the CSV content
        let mut csv_reader = ReaderBuilder::new()
            .has_headers(true)
            .from_reader(csv_content.as_bytes());

        // Process each record
        let mut equity_symbols = Vec::new();
        
        for result in csv_reader.deserialize() {
            let record: UpstoxInstrumentCsv = result
                .map_err(|e| ApiError::ExternalServiceError(format!("Failed to parse CSV record: {}", e)))?;
            
            // Filter for equity instruments only (EQ)
            if record.instrument_type == "EQUITY" && 
               record.exchange == "NSE_EQ" &&
               !record.trading_symbol.is_empty() {
                
                // Convert to our Symbol format
                let symbol = Symbol::new(
                    record.trading_symbol,
                    record.name,
                    "NSE".to_string(),
                    AssetType::Stock,
                );
                
                equity_symbols.push(symbol);
            }
        }

        tracing::info!("Fetched {} NSE equity symbols from Upstox", equity_symbols.len());
        Ok(equity_symbols)
    }

    /// Fetches a mock list of NSE symbols (for testing or when API is unavailable)
    pub fn get_mock_nse_symbols() -> Vec<Symbol> {
        // Common NSE stocks
        let symbols = vec![
            Symbol::new("RELIANCE".to_string(), "Reliance Industries Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("TCS".to_string(), "Tata Consultancy Services Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("HDFCBANK".to_string(), "HDFC Bank Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("INFY".to_string(), "Infosys Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("ICICIBANK".to_string(), "ICICI Bank Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("HINDUNILVR".to_string(), "Hindustan Unilever Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("SBIN".to_string(), "State Bank of India".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("BAJFINANCE".to_string(), "Bajaj Finance Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("BHARTIARTL".to_string(), "Bharti Airtel Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("KOTAKBANK".to_string(), "Kotak Mahindra Bank Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("WIPRO".to_string(), "Wipro Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("AXISBANK".to_string(), "Axis Bank Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("MARUTI".to_string(), "Maruti Suzuki India Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("TATAMOTORS".to_string(), "Tata Motors Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("SUNPHARMA".to_string(), "Sun Pharmaceutical Industries Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("ASIANPAINT".to_string(), "Asian Paints Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("TATASTEEL".to_string(), "Tata Steel Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("ADANIENT".to_string(), "Adani Enterprises Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("ADANIPORTS".to_string(), "Adani Ports and Special Economic Zone Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("NTPC".to_string(), "NTPC Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("POWERGRID".to_string(), "Power Grid Corporation of India Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("ONGC".to_string(), "Oil and Natural Gas Corporation Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("COALINDIA".to_string(), "Coal India Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("GAIL".to_string(), "GAIL (India) Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("BPCL".to_string(), "Bharat Petroleum Corporation Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("IOC".to_string(), "Indian Oil Corporation Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("TECHM".to_string(), "Tech Mahindra Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("HCLTECH".to_string(), "HCL Technologies Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("LT".to_string(), "Larsen & Toubro Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
            Symbol::new("ULTRACEMCO".to_string(), "UltraTech Cement Ltd.".to_string(), "NSE".to_string(), AssetType::Stock),
        ];

        tracing::info!("Using mock NSE symbols ({})", symbols.len());
        symbols
    }
}