use axum::{extract::State, Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use crate::state::AppState;
use std::sync::atomic::{AtomicBool, Ordering};

// Global flag to control analytics tracking
static ANALYTICS_ENABLED: AtomicBool = AtomicBool::new(true);

/// Get API analytics data
pub async fn get_analytics(State(state): State<AppState>) -> Json<serde_json::Value> {
    let analytics = state.analytics.as_ref()
        .expect("Analytics service not initialized");
    
    let summary = analytics.get_summary().await;
    Json(summary)
}

/// Request to update analytics configuration
#[derive(Debug, Deserialize)]
pub struct AnalyticsConfigRequest {
    /// Whether to enable analytics tracking
    #[serde(alias = "enableTracking")]
    pub enable_tracking: bool,
}

/// Response for analytics configuration update
#[derive(Debug, Serialize)]
pub struct AnalyticsConfigResponse {
    /// Whether analytics tracking is enabled
    pub tracking_enabled: bool,
    /// Message about the operation
    pub message: String,
}

/// Update analytics configuration
pub async fn update_analytics_config(
    State(_state): State<AppState>,
    Json(config): Json<AnalyticsConfigRequest>,
) -> (StatusCode, Json<AnalyticsConfigResponse>) {
    // Update the global flag
    ANALYTICS_ENABLED.store(config.enable_tracking, Ordering::SeqCst);
    
    // Log the change
    if config.enable_tracking {
        tracing::info!("Analytics tracking enabled");
    } else {
        tracing::info!("Analytics tracking disabled");
    }
    
    // Return the updated configuration
    let response = AnalyticsConfigResponse {
        tracking_enabled: config.enable_tracking,
        message: format!("Analytics tracking {}", if config.enable_tracking { "enabled" } else { "disabled" }),
    };
    
    (StatusCode::OK, Json(response))
}

/// Check if analytics tracking is enabled
pub fn is_analytics_enabled() -> bool {
    ANALYTICS_ENABLED.load(Ordering::SeqCst)
}