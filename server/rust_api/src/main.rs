mod models;
mod services;
mod handlers;
mod utils;

use axum::{
    routing::get,
    Router,
    http::{HeaderValue, Method},
};
use tower_http::{
    cors::{CorsLayer, Any},
    trace::TraceLayer,
};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use dotenv::dotenv;

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
    
    // Build our application with routes
    let app = Router::new()
        .route("/api/health", get(handlers::health::health_check))
        .route("/api/symbols/search", get(handlers::symbol::search_symbols))
        .route("/api/indices", get(handlers::market_index::get_indices))
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
        });
    
    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Listening on {}", addr);
    
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub symbol_service: services::symbol::SymbolService,
    pub market_index_service: services::market_index::MarketIndexService,
}