use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use crate::models::market_index::MarketIndicesCollection;
use crate::models::error::{ApiError, ErrorResponse};
use crate::AppState;

/// Query parameters for market indices
#[derive(Debug, Deserialize)]
pub struct IndicesQuery {
    /// Optional specific index symbol to retrieve
    pub symbol: Option<String>,
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