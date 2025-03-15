use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use crate::models::symbol::SymbolSearchResponse;
use crate::models::error::{ApiError, ErrorResponse};
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
            Ok(Json(SymbolSearchResponse { results }))
        }
        Err(e) => {
            tracing::error!("Symbol search error: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}