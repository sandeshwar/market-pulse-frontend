use axum::{
    extract::{State, Query},
    Json,
};
use serde::Deserialize;
use crate::state::AppState;
use crate::models::error::{ApiError, ErrorResponse};
use crate::models::symbol::BatchPriceResponse;
use crate::models::market_index::MarketIndicesCollection;
use crate::config::market_indices;

/// Query parameters for stock price requests
#[derive(Debug, Deserialize)]
pub struct StockPriceQuery {
    /// Comma-separated list of stock symbols
    pub symbols: String,
}

/// Query parameters for market index requests
#[derive(Debug, Deserialize)]
pub struct MarketIndexQuery {
    /// Comma-separated list of index symbols (optional)
    pub symbols: Option<String>,
}

/// Handler for getting stock prices - ONLY for stocks, not indices
pub async fn get_stock_prices(
    State(state): State<AppState>,
    Query(query): Query<StockPriceQuery>,
) -> Result<Json<BatchPriceResponse>, Json<ErrorResponse>> {
    let symbols: Vec<String> = query.symbols
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if symbols.is_empty() {
        return Err(Json(ErrorResponse::from(
            ApiError::InvalidRequest("No valid stock symbols provided".to_string())
        )));
    }

    // Filter out any index symbols that might have been passed
    // This ensures we only process actual stocks
    let stock_symbols: Vec<String> = symbols
        .into_iter()
        .filter(|symbol| !market_indices::get_index_display_name(symbol).is_some())
        .collect();

    if stock_symbols.is_empty() {
        return Err(Json(ErrorResponse::from(
            ApiError::InvalidRequest("No valid stock symbols provided (only indices were found)".to_string())
        )));
    }

    match state.market_data_service.get_symbol_prices(&stock_symbols).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Error getting stock prices: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

/// Handler for getting market indices - ONLY for indices, not stocks
///
/// This handler now uses the dedicated market_index_service instead of the market_data_service
/// since Tiingo doesn't support market indices directly.
pub async fn get_market_indices(
    State(state): State<AppState>,
    Query(query): Query<MarketIndexQuery>,
) -> Result<Json<MarketIndicesCollection>, Json<ErrorResponse>> {
    let indices: Vec<String> = match query.symbols {
        Some(symbols_str) => {
            let requested_indices: Vec<String> = symbols_str
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            // Filter to ensure we only process valid indices
            requested_indices
                .into_iter()
                .filter(|symbol| market_indices::get_index_display_name(symbol).is_some())
                .collect()
        },
        None => {
            // If no specific indices requested, return all available indices
            market_indices::get_default_display_indices()
        }
    };

    if indices.is_empty() {
        return Err(Json(ErrorResponse::from(
            ApiError::InvalidRequest("No valid index symbols provided".to_string())
        )));
    }

    // Use the market_index_service which now has a dedicated provider for indices
    let mut result = MarketIndicesCollection::new();

    for symbol in &indices {
        match state.market_index_service.get_index(symbol).await {
            Ok(Some(index)) => {
                result.upsert_index(index);
            },
            Ok(None) => {
                tracing::warn!("Index not found: {}", symbol);
            },
            Err(e) => {
                tracing::error!("Error getting index {}: {:?}", symbol, e);
            }
        }
    }

    // If we didn't find any indices, try to refresh them first
    if result.indices.is_empty() {
        tracing::info!("No indices found in cache, refreshing from provider");
        if let Err(e) = state.market_index_service.refresh_indices().await {
            tracing::error!("Error refreshing indices: {:?}", e);
        }

        // Try again after refresh
        for symbol in &indices {
            if let Ok(Some(index)) = state.market_index_service.get_index(symbol).await {
                result.upsert_index(index);
            }
        }
    }

    Ok(Json(result))
}

