use std::env;
use std::error::Error;
use dotenv::dotenv;
use market_pulse_api::services::market_data_provider::tiingo::TiingoClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Load environment variables from .env file
    dotenv().ok();
    
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    println!("=== Tiingo API Test ===");
    
    // Get API key from environment variables
    let api_key = env::var("TIINGO_API_KEY")
        .expect("TIINGO_API_KEY environment variable not set");
    
    println!("Using API key: {}", mask_string(&api_key));
    
    // Create the Tiingo client
    let client = TiingoClient::new(api_key);
    
    // Test US stock symbols
    let us_symbols = vec![
        "AAPL".to_string(),
        "MSFT".to_string(),
        "GOOGL".to_string(),
        "AMZN".to_string(),
        "TSLA".to_string(),
    ];
    
    // Test ETFs
    let etfs = vec![
        "SPY".to_string(),
        "QQQ".to_string(),
        "VTI".to_string(),
    ];
    
    // Test indices (represented as ETFs in Tiingo)
    let indices = vec![
        "SPY".to_string(),  // S&P 500
        "QQQ".to_string(),  // NASDAQ-100
        "DIA".to_string(),  // Dow Jones
    ];
    
    // Test fetching US stock symbols
    println!("\n=== Testing US Stock Symbols ===");
    match client.fetch_market_data(&us_symbols).await {
        Ok(prices) => {
            println!("Successfully fetched {} US stock symbols:", prices.len());
            for price in prices {
                println!("  {} - ${:.2} ({}%)", price.symbol, price.price, price.percent_change);
            }
        },
        Err(e) => {
            println!("Error fetching US stock symbols: {}", e);
        }
    }
    
    // Test fetching ETFs
    println!("\n=== Testing ETFs ===");
    match client.fetch_market_data(&etfs).await {
        Ok(prices) => {
            println!("Successfully fetched {} ETFs:", prices.len());
            for price in prices {
                println!("  {} - ${:.2} ({}%)", price.symbol, price.price, price.percent_change);
            }
        },
        Err(e) => {
            println!("Error fetching ETFs: {}", e);
        }
    }
    
    // Test fetching indices
    println!("\n=== Testing Market Indices ===");
    match client.fetch_market_indices(&indices).await {
        Ok(indices_data) => {
            println!("Successfully fetched {} indices:", indices_data.len());
            for index in indices_data {
                println!("  {} - {:.2} ({}%)", index.symbol, index.value, index.percent_change);
            }
        },
        Err(e) => {
            println!("Error fetching indices: {}", e);
        }
    }
    
    // Test metadata
    println!("\n=== Testing Metadata ===");
    match client.fetch_metadata("AAPL").await {
        Ok(Some(meta)) => {
            println!("Successfully fetched metadata for AAPL:");
            println!("  Ticker: {}", meta.ticker);
            println!("  Name: {}", meta.name);
            if let Some(desc) = meta.description {
                println!("  Description: {}", desc);
            }
            if let Some(exchange) = meta.exchangeCode {
                println!("  Exchange: {}", exchange);
            }
            if let Some(start_date) = meta.startDate {
                println!("  Start Date: {}", start_date);
            }
            if let Some(end_date) = meta.endDate {
                println!("  End Date: {}", end_date);
            }
        },
        Ok(None) => {
            println!("No metadata found for AAPL");
        },
        Err(e) => {
            println!("Error fetching metadata: {}", e);
        }
    }
    
    println!("\n=== Test Complete ===");
    
    Ok(())
}

// Helper function to mask sensitive information
fn mask_string(s: &str) -> String {
    if s.len() <= 8 {
        return "*".repeat(s.len());
    }
    
    let visible_chars = 4;
    let prefix = &s[0..visible_chars];
    let suffix = &s[s.len() - visible_chars..];
    
    format!("{}{}{}",
        prefix,
        "*".repeat(s.len() - (visible_chars * 2)),
        suffix
    )
}