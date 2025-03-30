use crate::models::market_index::{MarketIndex, MarketStatus};
use crate::models::error::ApiError;
use crate::services::market_index_provider::provider::MarketIndexProvider;
use async_trait::async_trait;
use reqwest::Client;
use std::time::Duration;
use chrono::Utc;
use scraper::{Html, Selector};

/// Wall Street Journal market index data provider
pub struct WsjMarketIndexProvider {
    client: Client,
    base_url: String,
}

impl WsjMarketIndexProvider {
    /// Creates a new WSJ market index provider
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: "https://www.wsj.com/market-data".to_string(),
        }
    }
    
    /// Maps WSJ index symbols to standard symbols
    fn map_symbol(&self, wsj_symbol: &str) -> String {
        match wsj_symbol {
            "DJIA" => "DJI".to_string(),
            "S&P 500" => "SPX".to_string(),
            "NASDAQ" => "IXIC".to_string(),
            "NASDAQ 100" => "NDX".to_string(),
            "CBOE Volatility" => "VIX".to_string(),
            _ => wsj_symbol.to_string(),
        }
    }
}

#[async_trait]
impl MarketIndexProvider for WsjMarketIndexProvider {
    async fn fetch_market_indices(&self, indices: &[String]) -> Result<Vec<MarketIndex>, ApiError> {
        if indices.is_empty() {
            return Ok(Vec::new());
        }
        
        // Create a set of requested indices for quick lookup
        let requested_indices: std::collections::HashSet<String> = indices.iter().cloned().collect();
        
        // Fetch the US market data page
        let url = format!("{}/us", self.base_url);
        let response = self.client.get(&url)
            .send()
            .await
            .map_err(|e| ApiError::ExternalServiceError(format!("WSJ request failed: {}", e)))?;
            
        if !response.status().is_success() {
            return Err(ApiError::ExternalServiceError(
                format!("WSJ returned error status: {}", response.status())
            ));
        }
        
        let html = response.text().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to get WSJ response body: {}", e)))?;
            
        // Parse the HTML
        let document = Html::parse_document(&html);
        
        // Define selectors for the index table
        let table_selector = Selector::parse("table.WSJTables--table").unwrap();
        let row_selector = Selector::parse("tr").unwrap();
        let cell_selector = Selector::parse("td").unwrap();
        let name_selector = Selector::parse("td.WSJTables--table__cell--2Sp9b").unwrap();
        
        let mut results = Vec::new();
        
        // Find the index table
        if let Some(table) = document.select(&table_selector).next() {
            // Process each row
            for row in table.select(&row_selector).skip(1) { // Skip header row
                let cells: Vec<_> = row.select(&cell_selector).collect();
                
                if cells.len() < 4 {
                    continue;
                }
                
                // Extract index name
                let name_cell = row.select(&name_selector).next();
                if name_cell.is_none() {
                    continue;
                }
                
                let name = name_cell.unwrap().text().collect::<String>().trim().to_string();
                let symbol = self.map_symbol(&name);
                
                // Skip if not in requested indices
                if !requested_indices.contains(&symbol) {
                    continue;
                }
                
                // Extract price, change, and percent change
                let price_text = cells[1].text().collect::<String>().trim().replace(",", "");
                let change_text = cells[2].text().collect::<String>().trim().replace(",", "");
                let percent_text = cells[3].text().collect::<String>().trim()
                    .replace("%", "").replace(",", "");
                
                // Parse values
                let price = price_text.parse::<f64>().unwrap_or(0.0);
                let change = change_text.parse::<f64>().unwrap_or(0.0);
                let percent_change = percent_text.parse::<f64>().unwrap_or(0.0);
                
                // Create the market index
                let index = MarketIndex {
                    symbol: symbol.clone(),
                    name,
                    value: price,
                    change,
                    percent_change,
                    status: MarketStatus::Open, // Assume open during market hours
                    timestamp: Some(Utc::now()),
                };
                
                results.push(index);
            }
        }
        
        Ok(results)
    }
    
    fn provider_name(&self) -> &str {
        "Wall Street Journal"
    }
}