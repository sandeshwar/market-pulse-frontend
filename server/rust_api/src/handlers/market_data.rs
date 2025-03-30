use axum::{
    extract::{State, Query},
    Json,
};
use serde::Deserialize;
use crate::state::AppState;
use crate::models::error::{ApiError, ErrorResponse};
use crate::models::symbol::BatchPriceResponse;
use crate::models::market_index::MarketIndicesCollection;

/// Query parameters for symbol price requests
#[derive(Debug, Deserialize)]
pub struct SymbolPriceQuery {
    /// Comma-separated list of symbols
    pub symbols: String,
}

/// Query parameters for market index requests
#[derive(Debug, Deserialize)]
pub struct MarketIndexQuery {
    /// Comma-separated list of index symbols (optional)
    pub symbols: Option<String>,
}

/// Handler for getting symbol prices
pub async fn get_symbol_prices(
    State(state): State<AppState>,
    Query(query): Query<SymbolPriceQuery>,
) -> Result<Json<BatchPriceResponse>, Json<ErrorResponse>> {
    let symbols: Vec<String> = query.symbols
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if symbols.is_empty() {
        return Err(Json(ErrorResponse::from(
            ApiError::InvalidRequest("No valid symbols provided".to_string())
        )));
    }

    match state.market_data_service.get_symbol_prices(&symbols).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Error getting symbol prices: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

/// Handler for getting market indices
pub async fn get_market_indices(
    State(state): State<AppState>,
    Query(query): Query<MarketIndexQuery>,
) -> Result<Json<MarketIndicesCollection>, Json<ErrorResponse>> {
    let indices: Vec<String> = match query.symbols {
        Some(symbols_str) => {
            symbols_str
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        },
        None => {
            // If no specific indices requested, return all available indices
            match state.market_index_service.get_all_indices().await {
                Ok(all_indices) => all_indices.indices.keys().cloned().collect::<Vec<String>>(),
                Err(e) => {
                    tracing::error!("Error getting all indices: {:?}", e);
                    return Err(Json(ErrorResponse::from(e)));
                }
            }
        }
    };

    match state.market_data_service.get_market_indices(&indices).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Error getting market indices: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}