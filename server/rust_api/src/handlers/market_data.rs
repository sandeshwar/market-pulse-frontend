use axum::{
    extract::{State, Query},
    Json,
};
use serde::Deserialize;
use crate::state::AppState;
use crate::models::error::{ApiError, ErrorResponse};
use crate::models::symbol::BatchPriceResponse;

/// Query parameters for stock price requests
#[derive(Debug, Deserialize)]
pub struct StockPriceQuery {
    /// Comma-separated list of stock symbols
    pub symbols: String,
}

/// Handler for getting stock prices
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

    match state.market_data_service.get_symbol_prices(&symbols).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Error getting stock prices: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

