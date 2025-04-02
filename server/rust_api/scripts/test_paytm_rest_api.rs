// This file is intentionally left empty to be removeduse std::env;
use std::error::Error;
use dotenv::dotenv;
use market_pulse_api::services::market_data_provider::paytm::PaytmMoneyClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Load environment variables from .env file
    dotenv().ok();
    
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    println!("=== Paytm Money REST API Test ===");
    
    // Get API credentials from environment variables
    let api_key = env::var("PAYTM_API_KEY")
        .expect("PAYTM_API_KEY environment variable not set");
    
    let access_token = env::var("PAYTM_ACCESS_TOKEN")
        .expect("PAYTM_ACCESS_TOKEN environment variable not set");
    
    let public_access_token = env::var("PAYTM_PUBLIC_ACCESS_TOKEN")
        .expect("PAYTM_PUBLIC_ACCESS_TOKEN environment variable not set");
    
    println!("Using API key: {}", mask_string(&api_key));
    println!("Using access token: {}", mask_string(&access_token));
    
    // Create the Paytm client
    let mut client = PaytmMoneyClient::new(api_key);
    client.set_access_token(access_token, public_access_token);
    
    // Test symbols for NSE
    let nse_symbols = vec![
        "RELIANCE.NSE".to_string(),
        "INFY.NSE".to_string(),
        "TCS.NSE".to_string(),
        "HDFCBANK.NSE".to_string(),
        "ICICIBANK.NSE".to_string(),
    ];
    
    // Test symbols for BSE
    let bse_symbols = vec![
        "RELIANCE.BSE".to_string(),
        "INFY.BSE".to_string(),
        "TCS.BSE".to_string(),
    ];
    
    // Test indices
    let indices = vec![
        "NIFTY50.NSE".to_string(),
        "BANKNIFTY.NSE".to_string(),
        "SENSEX.BSE".to_string(),
    ];
    
    // Test fetching NSE symbols
    println!("\n=== Testing NSE Symbols ===");
    match client.fetch_market_data(&nse_symbols).await {
        Ok(prices) => {
            println!("Successfully fetched {} NSE symbols:", prices.len());
            for price in prices {
                println!("  {} - ₹{:.2} ({}%)", price.symbol, price.price, price.percent_change);
            }
        },
        Err(e) => {
            println!("Error fetching NSE symbols: {}", e);
        }
    }
    
    // Test fetching BSE symbols
    println!("\n=== Testing BSE Symbols ===");
    match client.fetch_market_data(&bse_symbols).await {
        Ok(prices) => {
            println!("Successfully fetched {} BSE symbols:", prices.len());
            for price in prices {
                println!("  {} - ₹{:.2} ({}%)", price.symbol, price.price, price.percent_change);
            }
        },
        Err(e) => {
            println!("Error fetching BSE symbols: {}", e);
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