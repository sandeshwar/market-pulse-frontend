use axum::{
    extract::{Query, State},
    Json,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use crate::state::AppState;
// use crate::models::error::ApiError;

/// Query parameters for symbol search
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    /// The search query
    pub query: String,
    /// Maximum number of results to return
    #[serde(default = "default_limit")]
    pub limit: usize,
}

/// Default limit for search results
fn default_limit() -> usize {
    20
}

/// Query parameters for exchange filter
#[derive(Debug, Deserialize)]
pub struct ExchangeQuery {
    /// The exchange to filter by
    pub exchange: String,
    /// Maximum number of results to return
    #[serde(default = "default_limit")]
    pub limit: usize,
}

/// Query parameters for asset type filter
#[derive(Debug, Deserialize)]
pub struct AssetTypeQuery {
    /// The asset type to filter by
    pub asset_type: String,
    /// Maximum number of results to return
    #[serde(default = "default_limit")]
    pub limit: usize,
}

/// Response for symbol cache status
#[derive(Debug, Serialize)]
pub struct SymbolCacheStatus {
    /// Number of symbols in the cache
    pub symbol_count: usize,
    /// Last time the cache was updated
    pub last_updated: Option<i64>,
}



/// Handler for getting symbol cache status
pub async fn get_cache_status(
    State(state): State<AppState>,
) -> Result<Json<SymbolCacheStatus>, Response> {
    match state.symbol_cache_service.get_symbol_count().await {
        Ok(symbol_count) => {
            // Get the last updated timestamp using the service method
            match state.symbol_cache_service.get_last_updated().await {
                Ok(last_updated) => {
                    Ok(Json(SymbolCacheStatus {
                        symbol_count,
                        last_updated,
                    }))
                },
                Err(e) => Err(e.into_response())
            }
        },
        Err(e) => Err(e.into_response())
    }
}

/// Handler for searching symbols by prefix
pub async fn search_symbols_by_prefix(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<crate::services::symbol_cache::SymbolRecord>>, Response> {
    match state.symbol_cache_service.search_symbols_by_prefix(&params.query, params.limit).await {
        Ok(symbols) => Ok(Json(symbols)),
        Err(e) => Err(e.into_response())
    }
}

/// Handler for getting symbols by exchange
pub async fn get_symbols_by_exchange(
    State(state): State<AppState>,
    Query(params): Query<ExchangeQuery>,
) -> Result<Json<Vec<String>>, Response> {
    match state.symbol_cache_service.get_symbols_by_exchange(&params.exchange, params.limit).await {
        Ok(symbols) => Ok(Json(symbols)),
        Err(e) => Err(e.into_response())
    }
}

/// Handler for getting symbols by asset type
pub async fn get_symbols_by_asset_type(
    State(state): State<AppState>,
    Query(params): Query<AssetTypeQuery>,
) -> Result<Json<Vec<String>>, Response> {
    match state.symbol_cache_service.get_symbols_by_asset_type(&params.asset_type, params.limit).await {
        Ok(symbols) => Ok(Json(symbols)),
        Err(e) => Err(e.into_response())
    }
}

/// Handler for refreshing the symbol cache
pub async fn refresh_cache(
    State(state): State<AppState>,
) -> Result<Json<SymbolCacheStatus>, Response> {
    match state.symbol_cache_service.refresh_cache().await {
        Ok(symbol_count) => {
            // Get the last updated timestamp using the service method
            match state.symbol_cache_service.get_last_updated().await {
                Ok(last_updated) => {
                    Ok(Json(SymbolCacheStatus {
                        symbol_count,
                        last_updated,
                    }))
                },
                Err(e) => Err(e.into_response())
            }
        },
        Err(e) => Err(e.into_response())
    }
}