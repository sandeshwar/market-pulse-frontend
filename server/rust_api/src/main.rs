mod models;
mod services;
mod handlers;
mod utils;
mod state;
mod config;

use axum::{routing::get, Router, http::Method};
use tower_http::{cors::{CorsLayer, Any}, trace::TraceLayer};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use dotenv::dotenv;
use crate::state::AppState;

#[tokio::main]
async fn main() {
    // Load environment variables
    dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "market_pulse_api=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Initialize Redis manager
    let redis_manager = services::redis::RedisManager::new()
        .expect("Failed to create Redis manager");

    // Initialize the symbol cache service
    let symbols_file = std::env::var("TIINGO_SYMBOLS_FILE")
        .unwrap_or_else(|_| "../data/tiingo_symbols.csv".to_string());

    // Ensure data directory exists
    let data_dir = std::env::var("DATA_DIR").unwrap_or_else(|_| "../data".to_string());
    if !std::path::Path::new(&data_dir).exists() {
        tracing::info!("Creating data directory: {}", data_dir);
        std::fs::create_dir_all(&data_dir)
            .expect("Failed to create data directory");
    }

    let symbol_cache_service = services::symbol_cache::SymbolCacheService::new(
        redis_manager.clone(),
        symbols_file,
        7 // Cache TTL in days
    );

    // Initialize the symbol cache
    match symbol_cache_service.initialize().await {
        Ok(count) => tracing::info!("Initialized symbol cache with {} symbols", count),
        Err(e) => tracing::error!("Failed to initialize symbol cache: {}", e),
    }

    // Initialize other services
    tracing::info!("Initializing SymbolService...");
    let symbol_service = services::symbol::SymbolService::new().await;
    tracing::info!("SymbolService initialized.");

    // Check if we should skip market data initialization (for testing)
    let skip_market_data = std::env::var("SKIP_MARKET_DATA").unwrap_or_else(|_| "false".to_string()) == "true";

    let market_data_service = if skip_market_data {
        tracing::info!("Skipping market data initialization (SKIP_MARKET_DATA=true)");
        Arc::new(services::tiingo_market_data::TiingoMarketDataService::new())
    } else {
        // Create the Tiingo market data service for stocks
        let tiingo_service = Arc::new(services::tiingo_market_data::TiingoMarketDataService::new());

        // Start the background market data updater
        tracing::info!("Starting Tiingo background updater...");
        services::tiingo_market_data::TiingoMarketDataService::start_background_updater(tiingo_service.clone()).await;
        tracing::info!("Tiingo background updater started.");

        tiingo_service
    };

    // Initialize the indices market data service
    let indices_service = Arc::new(services::indices_market_data::IndicesMarketDataService::new());
    tracing::info!("Indices market data service initialized.");

    // Build our application with routes
    let app = Router::new()
        .route("/api/health", get(handlers::health::health_check))
        .route("/api/symbols/search", get(handlers::symbol::search_symbols))
        .route("/api/symbols/range", get(handlers::symbol::get_symbols_by_range))
        .route("/api/symbols/count", get(handlers::symbol::get_symbols_count))
        // Dedicated endpoints for stocks
        .route("/api/market-data/stocks", get(handlers::market_data::get_stock_prices))
        // Dedicated endpoints for indices
        .route("/api/market-data/indices", get(handlers::indices::get_indices_data))
        .route("/api/market-data/indices/all", get(handlers::indices::get_all_indices))
        // Symbol cache endpoints
        .route("/api/symbols/cache/status", get(handlers::symbol_cache::get_cache_status))
        .route("/api/symbols/cache/search", get(handlers::symbol_cache::search_symbols_by_prefix))
        .route("/api/symbols/cache/exchange", get(handlers::symbol_cache::get_symbols_by_exchange))
        .route("/api/symbols/cache/asset-type", get(handlers::symbol_cache::get_symbols_by_asset_type))
        .route("/api/symbols/cache/refresh", get(handlers::symbol_cache::refresh_cache))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers(Any)
        )
        .layer(TraceLayer::new_for_http())
        .with_state(AppState {
            symbol_service,
            symbol_cache_service,
            market_data_service,
            indices_data_service: Some(indices_service),
        });

    // Run the server
    let port = std::env::var("API_PORT").unwrap_or_else(|_| "3100".to_string()).parse::<u16>().unwrap_or(3100);
    let host = std::env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

    let addr_str = format!("{}:{}", host, port);
    tracing::info!("Attempting to bind to address: {}", addr_str);
    tracing::info!("Environment variables: API_PORT={}, API_HOST={}",
        std::env::var("API_PORT").unwrap_or_else(|_| "not set".to_string()),
        std::env::var("API_HOST").unwrap_or_else(|_| "not set".to_string())
    );

    // Explicitly parse the host IP address to ensure it's valid
    let ip_addr = match host.parse::<std::net::IpAddr>() {
        Ok(ip) => ip,
        Err(e) => {
            tracing::error!("Failed to parse host '{}' as IP address: {}", host, e);
            tracing::info!("Falling back to default IP 0.0.0.0");
            "0.0.0.0".parse::<std::net::IpAddr>().expect("Failed to parse default IP address")
        }
    };

    // Create the socket address from the parsed IP and port
    let addr = SocketAddr::new(ip_addr, port);
    tracing::info!("Attempting to bind to {} (port {}, host {})", addr, port, host);
    
    // Check for existing connections on the port
    if let Ok(output) = std::process::Command::new("lsof")
        .arg("-i")
        .arg(format!(":{}", port))
        .output() {
        if let Ok(out) = String::from_utf8(output.stdout) {
            if !out.is_empty() {
                tracing::warn!("Port {} might be in use:\n{}", port, out);
            }
        }
    }

    // Try to bind to the specified port, or try alternative ports if that fails
    let mut listener_result = tokio::net::TcpListener::bind(&addr).await;
    let mut current_port = port;
    let mut retry_count = 0;

    while listener_result.is_err() && retry_count < 3 {
        let err = listener_result.err().unwrap();
        tracing::error!("Failed to bind to {}: {}", addr, err);

        // Try the next port
        current_port += 1;
        retry_count += 1;

        let new_addr = SocketAddr::new(ip_addr, current_port);
        tracing::info!("Trying alternative port: {}", new_addr);

        listener_result = tokio::net::TcpListener::bind(&new_addr).await;
    }

    // If all retries failed, try binding to localhost as a fallback
    if listener_result.is_err() && ip_addr != std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST) {
        tracing::warn!("Failed to bind to {}. Trying localhost as fallback...", addr);
        let localhost_addr = SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST), port);
        listener_result = tokio::net::TcpListener::bind(&localhost_addr).await;

        // If localhost with original port fails, try with incremented ports
        let mut current_port = port;
        while listener_result.is_err() && retry_count < 6 {
            let err = listener_result.err().unwrap();
            tracing::error!("Failed to bind to localhost:{}: {}", current_port, err);

            current_port += 1;
            retry_count += 1;

            let new_addr = SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST), current_port);
            tracing::info!("Trying localhost with alternative port: {}", new_addr);

            listener_result = tokio::net::TcpListener::bind(&new_addr).await;
        }
    }

    match listener_result {
        Ok(listener) => {
            let local_addr = listener.local_addr().expect("Failed to get local address");
            tracing::info!("Successfully bound to {}", local_addr);

            if local_addr.port() != port {
                tracing::info!("Note: Using port {} instead of requested port {}",
                    local_addr.port(), port);
            }

            // Update the .env file with the actual port if it's different
            if local_addr.port() != port {
                match std::fs::read_to_string(".env") {
                    Ok(content) => {
                        let updated_content = if content.contains("API_PORT=") {
                            content.replace(&format!("API_PORT={}", port), &format!("API_PORT={}", local_addr.port()))
                        } else {
                            format!("{}API_PORT={}\n", content, local_addr.port())
                        };

                        if let Err(e) = std::fs::write(".env", updated_content) {
                            tracing::warn!("Failed to update API_PORT in .env file: {}", e);
                        } else {
                            tracing::info!("Updated API_PORT in .env file to {}", local_addr.port());
                        }
                    },
                    Err(e) => tracing::warn!("Failed to read .env file: {}", e)
                }
            }

            // Start the server
            tracing::info!("Starting Axum server on {}", local_addr);
            axum::serve(listener, app).await.unwrap();
        },
        Err(e) => {
            tracing::error!("Failed to bind to any port after multiple attempts: {}", e);
            tracing::error!("Please check if another process is using the ports or if you have permission to bind to them.");
            tracing::error!("You can specify a different port with the API_PORT environment variable.");
            panic!("Failed to bind to address: {}", e);
        }
    }
}

// Using AppState from state module