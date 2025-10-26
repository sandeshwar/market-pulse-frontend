use std::sync::Arc;
use crate::services::indices_market_data::IndicesMarketDataService;
use crate::services::news::NewsService;
use crate::utils::analytics::ApiAnalytics;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub indices_data_service: Option<Arc<IndicesMarketDataService>>,
    pub news_service: NewsService,
    pub analytics: Option<Arc<ApiAnalytics>>,
}