use std::env;
use std::error::Error;
use std::time::{Duration, Instant};
use dotenv::dotenv;
use market_pulse_api::services::market_data::MarketDataProvider;
use market_pulse_api::services::tiingo_market_data::TiingoMarketDataService;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Load environment variables from .env file
    dotenv().ok();
    
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    println!("=== Tiingo Market Data Service Test ===");
    
    // Verify environment variables
    check_env_vars();
    
    // Create the market data service
    println!("\nInitializing Tiingo Market Data Service...");
    let market_service = TiingoMarketDataService::new();
    println!("Tiingo Market Data Service initialized");
    
    // Test symbols
    let symbols = vec![
        "AAPL".to_string(),
        "MSFT".to_string(),
        "GOOGL".to_string(),
        "AMZN".to_string(),
        "TSLA".to_string(),
    ];
    
    // Test indices
    let indices = vec![
        "SPY".to_string(),  // S&P 500 ETF
        "QQQ".to_string(),  // NASDAQ-100 ETF
        "DIA".to_string(),  // Dow Jones ETF
    ];
    
    // Test 1: Initial fetch (should hit the API)
    println!("\n=== Test 1: Initial Data Fetch ===");
    let start = Instant::now();
    let result = market_service.get_symbol_prices(&symbols).await?;
    let elapsed = start.elapsed();
    
    println!("Fetched {} symbols in {:.2?}", result.prices.len(), elapsed);
    for (symbol, price) in &result.prices {
        println!("  {} - ${:.2} ({}%)", symbol, price.price, price.percent_change);
    }
    
    // Test 2: Cached fetch (should be faster)
    println!("\n=== Test 2: Cached Data Fetch ===");
    let start = Instant::now();
    let result = market_service.get_symbol_prices(&symbols).await?;
    let elapsed = start.elapsed();
    
    println!("Fetched {} symbols in {:.2?} (from cache)", result.prices.len(), elapsed);
    
    // Test 3: Fetch indices
    println!("\n=== Test 3: Market Indices ===");
    let start = Instant::now();
    let result = market_service.get_market_indices(&indices).await?;
    let elapsed = start.elapsed();
    
    println!("Fetched {} indices in {:.2?}", result.indices.len(), elapsed);
    for (symbol, index) in &result.indices {
        println!("  {} - {:.2} ({}%)", symbol, index.value, index.percent_change);
    }
    
    // Test 4: Background update
    println!("\n=== Test 4: Background Update ===");
    println!("Triggering background update...");
    market_service.update_all_cached_data().await?;
    println!("Background update completed");
    
    // Test 5: New symbol (should hit the API again)
    println!("\n=== Test 5: New Symbol Fetch ===");
    let new_symbols = vec!["NFLX".to_string()];
    
    let start = Instant::now();
    let result = market_service.get_symbol_prices(&new_symbols).await?;
    let elapsed = start.elapsed();
    
    println!("Fetched new symbol in {:.2?}", elapsed);
    for (symbol, price) in &result.prices {
        println!("  {} - ${:.2} ({}%)", symbol, price.price, price.percent_change);
    }
    
    // Test 6: Wait for cache expiration
    let cache_duration = env::var("MARKET_DATA_CACHE_DURATION")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(60);
    
    println!("\n=== Test 6: Cache Expiration ===");
    println!("Waiting for cache to expire ({} seconds)...", cache_duration);
    
    // Wait a bit longer than the cache duration to ensure expiration
    sleep(Duration::from_secs(cache_duration + 5)).await;
    
    // Fetch again after cache expiration
    let start = Instant::now();
    let result = market_service.get_symbol_prices(&symbols).await?;
    let elapsed = start.elapsed();
    
    println!("Fetched {} symbols in {:.2?} (after cache expiration)", result.prices.len(), elapsed);
    
    println!("\n=== Test Complete ===");
    
    Ok(())
}

// Helper function to check environment variables
fn check_env_vars() {
    println!("Checking environment variables...");
    
    let required_vars = [
        "TIINGO_API_KEY",
    ];
    
    let optional_vars = [
        "MARKET_DATA_CACHE_DURATION",
        "MARKET_DATA_STALE_THRESHOLD",
        "MARKET_DATA_UPDATE_INTERVAL",
    ];
    
    let mut all_required_present = true;
    
    for var in &required_vars {
        match env::var(var) {
            Ok(value) => {
                let masked = if value.len() > 8 {
                    let visible_chars = 4;
                    format!("{}{}{}",
                        &value[0..visible_chars],
                        "*".repeat(value.len() - (visible_chars * 2)),
                        &value[value.len() - visible_chars..]
                    )
                } else {
                    "*".repeat(value.len())
                };
                println!("  ✓ {} = {}", var, masked);
            },
            Err(_) => {
                println!("  ✗ {} is not set", var);
                all_required_present = false;
            }
        }
    }
    
    for var in &optional_vars {
        match env::var(var) {
            Ok(value) => println!("  ✓ {} = {}", var, value),
            Err(_) => println!("  ○ {} is not set (will use default)", var),
        }
    }
    
    if !all_required_present {
        panic!("Missing required environment variables. Please set them before running the test.");
    }
    
    println!("Environment variables check passed");
}