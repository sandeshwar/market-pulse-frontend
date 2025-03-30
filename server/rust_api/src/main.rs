mod models;
mod services;
mod handlers;
mod utils;
mod state;

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

    // Initialize services
    let symbol_service = services::symbol::SymbolService::new().await;
    let market_index_service = services::market_index::MarketIndexService::new().await;

    // Create the Tiingo market data service
    let tiingo_service = Arc::new(services::tiingo_market_data::TiingoMarketDataService::new());

    // Start the background market data updater
    services::tiingo_market_data::TiingoMarketDataService::start_background_updater(tiingo_service.clone()).await;

    // Use the Tiingo service as our market data provider
    let market_data_service = tiingo_service;

    // Build our application with routes
    let app = Router::new()
        .route("/api/health", get(handlers::health::health_check))
        .route("/api/symbols/search", get(handlers::symbol::search_symbols))
        .route("/api/indices", get(handlers::market_index::get_indices))
        .route("/api/market-data/prices", get(handlers::market_data::get_symbol_prices))
        .route("/api/market-data/indices", get(handlers::market_data::get_market_indices))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers(Any)
        )
        .layer(TraceLayer::new_for_http())
        .with_state(AppState {
            symbol_service,
            market_index_service,
            market_data_service,
        });

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// Using AppState from state module