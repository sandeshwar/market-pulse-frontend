use axum::{
    extract::{State, Query},
    Json,
};
use serde::Deserialize;
use crate::state::AppState;
use crate::models::error::{ApiError, ErrorResponse};
use crate::models::symbol::BatchPriceResponse;
use crate::services::market_data::{MarketDataProviderEnum, MarketDataProvider};

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

/// Handler for getting Indian stock prices using Upstox
pub async fn get_indian_stock_prices(
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

    // Check if Upstox service is available
    let upstox_service = match &state.upstox_market_data_service {
        Some(service) => service,
        None => {
            return Err(Json(ErrorResponse::from(
                ApiError::InternalError("Upstox market data service not available".to_string())
            )));
        }
    };

    // For NSE stocks, we need to ensure the symbols are in the correct format
    // If they don't already have a prefix, add "NSE_EQ:" prefix
    let formatted_symbols: Vec<String> = symbols
        .iter()
        .map(|s| {
            if !s.contains(':') && !s.contains('|') {
                format!("NSE_EQ:{}", s)
            } else {
                s.clone()
            }
        })
        .collect();

    match upstox_service.get_symbol_prices(&formatted_symbols).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            tracing::error!("Error getting Indian stock prices: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}

