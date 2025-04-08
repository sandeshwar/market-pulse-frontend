use std::time::Instant;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::collections::HashMap;
use tokio::sync::RwLock;
use axum::http::{Request, Response};
use axum::middleware::Next;
use axum::body::Body;
use tracing::{info, debug};
use chrono::{DateTime, Utc};

/// Analytics data structure to track API usage
#[derive(Debug, Clone)]
pub struct ApiAnalytics {
    /// Total number of requests processed
    total_requests: Arc<AtomicUsize>,
    /// Requests per endpoint
    endpoint_counts: Arc<RwLock<HashMap<String, usize>>>,
    /// Response times per endpoint (in milliseconds)
    response_times: Arc<RwLock<HashMap<String, Vec<u128>>>>,
    /// Errors per endpoint
    error_counts: Arc<RwLock<HashMap<String, usize>>>,
    /// Last request timestamp
    last_request_time: Arc<RwLock<DateTime<Utc>>>,
}

impl Default for ApiAnalytics {
    fn default() -> Self {
        Self::new()
    }
}

impl ApiAnalytics {
    /// Create a new ApiAnalytics instance
    pub fn new() -> Self {
        Self {
            total_requests: Arc::new(AtomicUsize::new(0)),
            endpoint_counts: Arc::new(RwLock::new(HashMap::new())),
            response_times: Arc::new(RwLock::new(HashMap::new())),
            error_counts: Arc::new(RwLock::new(HashMap::new())),
            last_request_time: Arc::new(RwLock::new(Utc::now())),
        }
    }

    /// Get total request count
    pub fn total_requests(&self) -> usize {
        self.total_requests.load(Ordering::Relaxed)
    }

    /// Get a copy of the current endpoint counts
    pub async fn endpoint_counts(&self) -> HashMap<String, usize> {
        self.endpoint_counts.read().await.clone()
    }

    /// Get average response times per endpoint
    pub async fn average_response_times(&self) -> HashMap<String, f64> {
        let times = self.response_times.read().await;
        let mut averages = HashMap::new();
        
        for (endpoint, times_vec) in times.iter() {
            if !times_vec.is_empty() {
                let sum: u128 = times_vec.iter().sum();
                let avg = sum as f64 / times_vec.len() as f64;
                averages.insert(endpoint.clone(), avg);
            }
        }
        
        averages
    }

    /// Get error counts per endpoint
    pub async fn error_counts(&self) -> HashMap<String, usize> {
        self.error_counts.read().await.clone()
    }

    /// Get the timestamp of the last request
    pub async fn last_request_time(&self) -> DateTime<Utc> {
        *self.last_request_time.read().await
    }

    /// Get analytics summary as JSON
    pub async fn get_summary(&self) -> serde_json::Value {
        let total = self.total_requests();
        let endpoints = self.endpoint_counts().await;
        let avg_times = self.average_response_times().await;
        let errors = self.error_counts().await;
        let last_request = self.last_request_time().await;

        serde_json::json!({
            "total_requests": total,
            "endpoint_counts": endpoints,
            "average_response_times_ms": avg_times,
            "error_counts": errors,
            "last_request": last_request.to_rfc3339(),
        })
    }
}

/// Middleware function to track API analytics
pub async fn track_analytics(
    analytics: &ApiAnalytics,
    req: Request<Body>,
    next: Next,
) -> Response<Body> {
    // Record the start time
    let start = Instant::now();
    
    // Extract the path for analytics
    let path = req.uri().path().to_string();
    let method = req.method().to_string();
    
    // Normalize ticker endpoints to group them together
    let normalized_path = normalize_endpoint_path(&path);
    let endpoint = format!("{} {}", method, normalized_path);
    
    // Update last request time
    *analytics.last_request_time.write().await = Utc::now();
    
    // Increment total request counter
    analytics.total_requests.fetch_add(1, Ordering::Relaxed);
    
    // Increment endpoint counter
    {
        let mut counts = analytics.endpoint_counts.write().await;
        *counts.entry(endpoint.clone()).or_insert(0) += 1;
    }
    
    debug!("Request started: {} (original: {})", endpoint, path);
    
    // Process the request
    let response = next.run(req).await;
    
    // Calculate response time
    let duration = start.elapsed().as_millis();
    
    // Record response time
    {
        let mut times = analytics.response_times.write().await;
        times.entry(endpoint.clone()).or_insert_with(Vec::new).push(duration);
    }
    
    // Check if response is an error
    let status = response.status();
    if status.is_client_error() || status.is_server_error() {
        let mut errors = analytics.error_counts.write().await;
        *errors.entry(endpoint.clone()).or_insert(0) += 1;
        info!("Error response: {} - Status: {}", endpoint, status.as_u16());
    }
    
    debug!("Request completed: {} - Status: {} - Duration: {}ms", 
           endpoint, status.as_u16(), duration);
    
    response
}

/// Normalize endpoint paths to group similar endpoints together
/// For example, all ticker endpoints like /api/market-data/news/ticker/AAPL will be
/// normalized to /api/market-data/news/ticker/:symbol
fn normalize_endpoint_path(path: &str) -> String {
    // Normalize ticker-related endpoints
    if path.starts_with("/api/market-data/news/ticker/") {
        return "/api/market-data/news/ticker/:symbol".to_string();
    }
    
    // Normalize other market data endpoints with symbols
    if path.starts_with("/api/market-data/price/") {
        return "/api/market-data/price/:symbol".to_string();
    }
    
    if path.starts_with("/api/market-data/chart/") {
        return "/api/market-data/chart/:symbol".to_string();
    }
    
    if path.starts_with("/api/market-data/fundamentals/") {
        return "/api/market-data/fundamentals/:symbol".to_string();
    }
    
    // Add more patterns as needed for other endpoints with dynamic segments
    
    // Return the original path for endpoints that don't need normalization
    path.to_string()
}