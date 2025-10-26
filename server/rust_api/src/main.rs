mod models;
mod services;
mod handlers;
mod utils;
mod state;
mod config;

use axum::{routing::get, Router, http::Method, middleware, body::Body, http::Request};
use axum::middleware::Next;
use tower_http::{cors::{CorsLayer, Any}, trace::TraceLayer};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use dotenv::dotenv;
use crate::state::AppState;
use crate::utils::analytics::{ApiAnalytics, track_analytics};

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

    // Ensure data directory exists
    let data_dir = std::env::var("DATA_DIR").unwrap_or_else(|_| "../data".to_string());
    if !std::path::Path::new(&data_dir).exists() {
        tracing::info!("Creating data directory: {}", data_dir);
        std::fs::create_dir_all(&data_dir)
            .expect("Failed to create data directory");
    }

    // Remove stock symbol services and Upstox initialization (indices-only)

    // Initialize the indices market data service
    let indices_service = Arc::new(services::indices_market_data::IndicesMarketDataService::new());
    tracing::info!("Indices market data service initialized.");

    // Initialize the news service with mock provider
    let redis_arc = Arc::new(redis_manager.clone());
    let news_service = services::news::NewsService::new_with_mock(redis_arc);
    tracing::info!("News service initialized with mock provider");

    // Initialize analytics service
    let analytics_service = Arc::new(ApiAnalytics::new());
    let analytics_service_clone = analytics_service.clone();

    // Build our application with routes (indices/news/health/analytics only)
    let app = Router::new()
        .route("/api/health", get(handlers::health::health_check))
        // Indices endpoints
        .route("/api/market-data/indices", get(handlers::indices::get_indices_data))
        .route("/api/market-data/indices/all", get(handlers::indices::get_all_indices))
        // News endpoints
        .route("/api/market-data/news/trending", get(handlers::news::get_trending_news))
        .route("/api/market-data/news/ticker/:ticker", get(handlers::news::get_ticker_news))
        .route("/api/market-data/news/personalized", get(handlers::news::get_personalized_news))
        .route("/api/market-data/news/filtered", get(handlers::news::get_filtered_news))
        // Analytics endpoints
        .route("/api/analytics", get(handlers::analytics::get_analytics))
        .route("/api/analytics/config", axum::routing::post(handlers::analytics::update_analytics_config))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers(Any)
        )
        .layer(TraceLayer::new_for_http())
        // Add analytics middleware to track all requests (with conditional tracking)
        .layer(middleware::from_fn(move |req: Request<Body>, next: Next| {
            let analytics_service = analytics_service_clone.clone();
            async move {
                // Get the path for checking if it's an analytics endpoint
                let path = req.uri().path();
                let is_analytics_endpoint = path.starts_with("/api/analytics");
                
                // Only track analytics if enabled and not an analytics endpoint itself
                if crate::handlers::analytics::is_analytics_enabled() && !is_analytics_endpoint {
                    track_analytics(&analytics_service, req, next).await
                } else {
                    // Skip analytics tracking
                    next.run(req).await
                }
            }
        }))
        .with_state(AppState {
            indices_data_service: Some(indices_service),
            news_service,
            analytics: Some(analytics_service),
        });

    // Run the server
    let port = std::env::var("API_PORT").unwrap_or_else(|_| "3001".to_string()).parse::<u16>().unwrap_or(3001);
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