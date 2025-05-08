use axum::{
    extract::State,
    Json,
};
use serde::Serialize;
use crate::state::AppState;
use crate::models::error::ErrorResponse;

/// Response for Upstox symbols update
#[derive(Debug, Serialize)]
pub struct UpstoxSymbolsUpdateResponse {
    /// Status of the update
    pub status: String,
    /// Total number of symbols after update
    pub total_symbols: usize,
}

/// Handler for updating Upstox NSE symbols
pub async fn update_upstox_symbols(
    State(state): State<AppState>,
) -> Result<Json<UpstoxSymbolsUpdateResponse>, Json<ErrorResponse>> {
    // Trigger the update of Upstox NSE symbols
    match state.symbol_service.fetch_and_merge_upstox_symbols().await {
        Ok(_) => {
            // Get the updated symbol count
            let total_symbols = state.symbol_service.get_symbols_count().await;
            
            tracing::info!("Successfully updated Upstox NSE symbols, total symbols: {}", total_symbols);
            
            Ok(Json(UpstoxSymbolsUpdateResponse {
                status: "success".to_string(),
                total_symbols,
            }))
        },
        Err(e) => {
            tracing::error!("Failed to update Upstox NSE symbols: {:?}", e);
            Err(Json(ErrorResponse::from(e)))
        }
    }
}