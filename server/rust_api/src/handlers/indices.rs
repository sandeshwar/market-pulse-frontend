use axum::{
    extract::{State, Query},
    Json,
};
use serde::Deserialize;
use crate::state::AppState;
use crate::models::error::{ApiError, ErrorResponse};
use crate::models::symbol::BatchPriceResponse;
use crate::services::market_data::{MarketDataProviderEnum, MarketDataProvider};


/// Query parameters for indices data requests
#[derive(Debug, Deserialize)]
pub struct IndicesQuery {
    /// Comma-separated list of index symbols
    pub symbols: String,
}

/// Handler for getting indices data
pub async fn get_indices_data(
    State(state): State<AppState>,
    Query(query): Query<IndicesQuery>,
) -> Result<Json<BatchPriceResponse>, Json<ErrorResponse>> {
    let symbols: Vec<String> = query.symbols
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if symbols.is_empty() {
        return Err(Json(ErrorResponse::from(
            ApiError::InvalidRequest("No valid index symbols provided".to_string())
        )));
    }

    // Get the indices market data service from the state
    let indices_service = match &state.indices_data_service {
        Some(service) => service.clone(),
        None => {
            return Err(Json(ErrorResponse::from(
                ApiError::InternalError("Indices data service not available".to_string())
            )));
        }
    };

    // Create a MarketDataProviderEnum from the service
    let provider = MarketDataProviderEnum::Indices(indices_service);

    // Get the indices data
    match provider.get_symbol_prices(&symbols).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Error getting indices data: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

/// Handler for getting all available indices
pub async fn get_all_indices(
    State(state): State<AppState>,
) -> Result<Json<BatchPriceResponse>, Json<ErrorResponse>> {
    // Get the indices market data service from the state
    let indices_service = match &state.indices_data_service {
        Some(service) => service.clone(),
        None => {
            return Err(Json(ErrorResponse::from(
                ApiError::InternalError("Indices data service not available".to_string())
            )));
        }
    };

    // Create a MarketDataProviderEnum from the service
    let provider = MarketDataProviderEnum::Indices(indices_service);

    // Get all indices (empty array means get all available)
    match provider.get_symbol_prices(&[]).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Error getting all indices data: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}