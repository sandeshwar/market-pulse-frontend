use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use crate::models::symbol::SymbolSearchResponse;
use crate::models::error::{ErrorResponse, ApiError};
use crate::AppState;

/// Query parameters for symbol search
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    /// Search query string
    pub q: Option<String>,

    /// Maximum number of results to return
    #[serde(default = "default_limit")]
    pub limit: usize,
}

/// Query parameters for fetching symbols by range
#[derive(Debug, Deserialize)]
pub struct RangeQuery {
    /// Start index (inclusive)
    pub start: usize,

    /// End index (exclusive)
    pub end: usize,
}

fn default_limit() -> usize {
    10
}

/// Handler for symbol search
pub async fn search_symbols(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<SymbolSearchResponse>, Json<ErrorResponse>> {
    let query = match params.q {
        Some(q) if !q.trim().is_empty() => q.trim().to_string(),
        _ => {
            return Ok(Json(SymbolSearchResponse { results: vec![] }));
        }
    };

    if query.len() < 2 {
        return Ok(Json(SymbolSearchResponse { results: vec![] }));
    }

    let limit = params.limit.min(100); // Cap at 100 results

    match state.symbol_service.search_symbols(&query, limit).await {
        Ok(results) => {
            // Add a note to the results
            if !results.is_empty() {
                tracing::info!("Found {} symbols matching '{}' from Upstox's supported list", results.len(), query);
            } else {
                tracing::info!("No symbols found matching '{}'", query);
            }

            Ok(Json(SymbolSearchResponse { results }))
        }
        Err(e) => {
            tracing::error!("Symbol search error: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

/// Handler for fetching symbols by range (for troubleshooting)
pub async fn get_symbols_by_range(
    State(state): State<AppState>,
    Query(params): Query<RangeQuery>,
) -> Result<Json<SymbolSearchResponse>, Json<ErrorResponse>> {
    // Validate range parameters
    if params.start >= params.end {
        return Err(Json(ErrorResponse::from(
            ApiError::InvalidRequest(format!("Start index {} must be less than end index {}", params.start, params.end))
        )));
    }

    // Limit the range size to prevent excessive memory usage
    const MAX_RANGE_SIZE: usize = 1000;
    let range_size = params.end - params.start;
    if range_size > MAX_RANGE_SIZE {
        return Err(Json(ErrorResponse::from(
            ApiError::InvalidRequest(format!("Range size {} exceeds maximum allowed size of {}", range_size, MAX_RANGE_SIZE))
        )));
    }

    // Get symbols by range
    match state.symbol_service.get_symbols_by_range(params.start, params.end).await {
        Ok(results) => {
            tracing::info!("Fetched {} symbols from range [{}, {}]", results.len(), params.start, params.end);
            Ok(Json(SymbolSearchResponse { results }))
        }
        Err(e) => {
            tracing::error!("Error fetching symbols by range: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

/// Response for symbol count
#[derive(Debug, serde::Serialize)]
pub struct SymbolCountResponse {
    /// Total number of symbols
    pub count: usize,
}

/// Handler for getting the total count of symbols
pub async fn get_symbols_count(
    State(state): State<AppState>,
) -> Json<SymbolCountResponse> {
    let count = state.symbol_service.get_symbols_count().await;
    tracing::info!("Returning total symbol count: {}", count);
    Json(SymbolCountResponse { count })
}