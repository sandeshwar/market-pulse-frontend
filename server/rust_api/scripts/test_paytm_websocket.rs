use std::env;
use std::error::Error;
use std::time::Duration;
use dotenv::dotenv;
use market_pulse_api::services::market_data_provider::paytm_websocket::PaytmWebSocketClient;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Load environment variables from .env file
    dotenv().ok();
    
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    println!("=== Paytm Money WebSocket Test ===");
    
    // Get API credentials from environment variables
    let api_key = env::var("PAYTM_API_KEY")
        .expect("PAYTM_API_KEY environment variable not set");
    
    let access_token = env::var("PAYTM_ACCESS_TOKEN")
        .expect("PAYTM_ACCESS_TOKEN environment variable not set");
    
    let public_access_token = env::var("PAYTM_PUBLIC_ACCESS_TOKEN")
        .expect("PAYTM_PUBLIC_ACCESS_TOKEN environment variable not set");
    
    println!("Using API key: {}", mask_string(&api_key));
    println!("Using access token: {}", mask_string(&access_token));
    
    // Create the WebSocket client
    let mut ws_client = PaytmWebSocketClient::new(
        api_key,
        access_token,
        public_access_token,
    );
    
    // Start the WebSocket connection
    println!("\nStarting WebSocket connection...");
    let mut rx = ws_client.start().await?;
    println!("WebSocket connection established");
    
    // Test symbols to subscribe to
    let symbols = vec![
        "RELIANCE.NSE".to_string(),
        "INFY.NSE".to_string(),
        "TCS.NSE".to_string(),
        "HDFCBANK.NSE".to_string(),
        "ICICIBANK.NSE".to_string(),
        "NIFTY50.NSE".to_string(),
    ];
    
    // Subscribe to symbols
    println!("\nSubscribing to {} symbols...", symbols.len());
    ws_client.subscribe(&symbols).await?;
    println!("Subscription request sent");
    
    // Listen for updates for a period of time
    println!("\nListening for updates (30 seconds)...");
    println!("Press Ctrl+C to stop early");
    
    let timeout = Duration::from_secs(30);
    let start = std::time::Instant::now();
    
    let mut update_count = 0;
    
    while start.elapsed() < timeout {
        tokio::select! {
            Some(price) = rx.recv() => {
                update_count += 1;
                println!("[{}] {} - ₹{:.2} ({}%)", 
                    update_count,
                    price.symbol, 
                    price.price, 
                    price.percent_change
                );
            }
            _ = sleep(Duration::from_millis(100)) => {
                // Just a small delay to prevent tight loop
            }
        }
    }
    
    // Unsubscribe from symbols
    println!("\nUnsubscribing from symbols...");
    ws_client.unsubscribe(&symbols).await?;
    println!("Unsubscribe request sent");
    
    // Summary
    println!("\n=== Test Summary ===");
    println!("Received {} price updates in {} seconds", 
        update_count,
        start.elapsed().as_secs()
    );
    
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