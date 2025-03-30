use std::sync::Arc;
use crate::services::symbol::SymbolService;
use crate::services::market_index::MarketIndexService;
use crate::services::market_data::MarketDataProvider;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub symbol_service: SymbolService,
    pub market_index_service: MarketIndexService,
    pub market_data_service: Arc<dyn MarketDataProvider>,
}