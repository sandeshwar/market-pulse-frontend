use std::error::Error;
use dotenv::dotenv;
use market_pulse_api::services::symbol::SymbolService;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Load environment variables from .env file
    dotenv().ok();

    // Initialize logging
    tracing_subscriber::fmt::init();

    println!("=== Tiingo Symbols Test ===");

    // Create the symbol service
    let symbol_service = SymbolService::new().await;

    // Test downloading symbols from Tiingo
    println!("\n=== Testing Tiingo Symbols Download ===");
    match symbol_service.download_tiingo_symbols().await {
        Ok(true) => {
            println!("Successfully downloaded symbols from Tiingo");

            // Give a moment for the data to be processed
            tokio::time::sleep(Duration::from_millis(500)).await;

            // Get the total count of symbols
            let symbols_count = symbol_service.get_symbols_count().await;
            println!("Total symbols in memory: {}", symbols_count);

            // Check Redis storage
            let redis_count = symbol_service.get_redis_symbols_count().await;
            println!("Total symbols in Redis: {}", redis_count);

            // Test searching for some common symbols
            let test_symbols = vec!["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

            for symbol in test_symbols {
                match symbol_service.search_symbols(symbol, 5).await {
                    Ok(results) => {
                        println!("\nSearch results for '{}': {} matches", symbol, results.len());
                        for (i, result) in results.iter().enumerate() {
                            println!("  {}. {} - {} ({})", i+1, result.symbol, result.name, result.exchange);
                        }
                    },
                    Err(e) => {
                        println!("Error searching for symbol {}: {}", symbol, e);
                    }
                }
            }

            // Test searching for a partial name
            let test_queries = vec!["Apple", "Microsoft", "Google", "Amazon", "Tesla"];

            for query in test_queries {
                match symbol_service.search_symbols(query, 5).await {
                    Ok(results) => {
                        println!("\nSearch results for '{}': {} matches", query, results.len());
                        for (i, result) in results.iter().enumerate() {
                            println!("  {}. {} - {} ({})", i+1, result.symbol, result.name, result.exchange);
                        }
                    },
                    Err(e) => {
                        println!("Error searching for query {}: {}", query, e);
                    }
                }
            }

            // Test a non-existent symbol
            println!("\nTesting search for non-existent symbol:");
            match symbol_service.search_symbols("NONEXISTENT123", 5).await {
                Ok(results) => {
                    println!("Search results for 'NONEXISTENT123': {} matches", results.len());
                },
                Err(e) => {
                    println!("Error searching for non-existent symbol: {}", e);
                }
            }
        },
        Ok(false) => {
            println!("No symbols downloaded from Tiingo");
        },
        Err(e) => {
            println!("Error downloading symbols from Tiingo: {}", e);
        }
    }

    println!("\n=== Test Complete ===");

    Ok(())
}