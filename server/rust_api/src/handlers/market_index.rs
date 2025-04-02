use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use crate::models::market_index::MarketIndicesCollection;
use crate::models::error::{ApiError, ErrorResponse};
use crate::config::market_indices;
use crate::AppState;
use std::collections::HashMap;

/// Query parameters for market indices
#[derive(Debug, Deserialize)]
pub struct IndicesQuery {
    /// Optional specific index symbol to retrieve
    pub symbol: Option<String>,
}

/// Response for available indices
#[derive(Debug, serde::Serialize)]
pub struct AvailableIndicesResponse {
    /// List of available index symbols
    pub symbols: Vec<String>,
    /// Map of index symbols to their display names
    pub display_names: HashMap<String, String>,
}

/// Handler for getting market indices
pub async fn get_indices(
    State(state): State<AppState>,
    Query(params): Query<IndicesQuery>,
) -> Result<Json<MarketIndicesCollection>, Json<ErrorResponse>> {
    // If a specific symbol is requested, return just that index
    if let Some(symbol) = params.symbol {
        match state.market_index_service.get_index(&symbol).await {
            Ok(Some(index)) => {
                let mut collection = MarketIndicesCollection::new();
                collection.upsert_index(index);
                return Ok(Json(collection));
            }
            Ok(None) => {
                return Err(Json(ErrorResponse::from(
                    ApiError::NotFound(format!("Index not found: {}", symbol))
                )));
            }
            Err(e) => {
                tracing::error!("Error getting index {}: {:?}", symbol, e);
                return Err(Json(ErrorResponse::from(e)));
            }
        }
    }

    // Otherwise return all indices
    match state.market_index_service.get_all_indices().await {
        Ok(indices) => {
            Ok(Json(indices))
        }
        Err(e) => {
            tracing::error!("Error getting indices: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

/// Handler for getting available market indices
pub async fn get_available_indices() -> Json<AvailableIndicesResponse> {
    // Get all available indices from our centralized configuration
    let symbols = market_indices::get_all_index_symbols();

    // Create a map of symbols to display names
    let mut display_names = HashMap::new();
    for symbol in &symbols {
        if let Some(name) = market_indices::get_index_display_name(symbol) {
            display_names.insert(symbol.clone(), name);
        }
    }

    Json(AvailableIndicesResponse {
        symbols,
        display_names,
    })
}

/// Handler for getting default display indices
pub async fn get_default_display_indices() -> Json<Vec<String>> {
    Json(market_indices::get_default_display_indices())
}