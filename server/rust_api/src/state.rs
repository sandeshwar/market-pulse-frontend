use std::sync::Arc;
use crate::services::symbol::SymbolService;
use crate::services::symbol_cache::SymbolCacheService;
use crate::services::market_data::MarketDataProvider;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub symbol_service: SymbolService,
    pub symbol_cache_service: SymbolCacheService,
    pub market_data_service: Arc<dyn MarketDataProvider>,
}