use std::sync::Arc;
use crate::services::symbol::SymbolService;
use crate::services::symbol_cache::SymbolCacheService;
use crate::services::market_data::MarketDataProvider;
use crate::services::indices_market_data::IndicesMarketDataService;
use crate::services::upstox_market_data::UpstoxMarketDataService;
use crate::services::news::NewsService;
use crate::utils::analytics::ApiAnalytics;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub symbol_service: SymbolService,
    pub symbol_cache_service: SymbolCacheService,
    pub market_data_service: Arc<dyn MarketDataProvider>,
    pub upstox_market_data_service: Option<Arc<UpstoxMarketDataService>>,
    pub indices_data_service: Option<Arc<IndicesMarketDataService>>,
    pub news_service: NewsService,
    pub analytics: Option<Arc<ApiAnalytics>>,
}