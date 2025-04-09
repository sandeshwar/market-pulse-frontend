use axum::{
    extract::{Path, Query, State},

    Json,
};
use serde::Deserialize;
use crate::models::error::ApiError;
use crate::models::news::{NewsResponse, NewsRequest};
use crate::state::AppState;

/// Query parameters for news requests
#[derive(Debug, Deserialize)]
pub struct NewsQueryParams {
    /// Tags to filter news by (comma-separated)
    pub tags: Option<String>,
    
    /// Categories to filter news by (comma-separated)
    pub categories: Option<String>,
    
    /// Maximum number of articles to return
    pub limit: Option<usize>,
    
    /// Offset for pagination
    pub offset: Option<usize>,
    
    /// Sort order (e.g., "publishedDate:desc")
    pub sort: Option<String>,
    
    /// User's location for localized news
    pub location: Option<String>,
    
    /// User's preferred topics
    pub topics: Option<String>,
}

/// Query parameters for personalized news
#[derive(Debug, Deserialize)]
pub struct PersonalizedNewsParams {
    /// Ticker symbols to filter news by (comma-separated)
    pub tickers: Option<String>,
    
    /// User's preferred topics (comma-separated)
    pub topics: Option<String>,
    
    /// User's location for localized news
    pub location: Option<String>,
    
    /// Maximum number of articles to return
    pub limit: Option<usize>,
}

/// Handler for fetching trending news
pub async fn get_trending_news(
    State(state): State<AppState>,
    Query(params): Query<NewsQueryParams>,
) -> Result<Json<NewsResponse>, ApiError> {
    let limit = params.limit.unwrap_or(10);
    
    let news = state.news_service.get_trending_news(Some(limit)).await?;
    
    Ok(Json(news))
}

/// Handler for fetching news for a specific ticker
pub async fn get_ticker_news(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(params): Query<NewsQueryParams>,
) -> Result<Json<NewsResponse>, ApiError> {
    let limit = params.limit.unwrap_or(10);
    
    let news = state.news_service.get_ticker_news(&ticker, Some(limit)).await?;
    
    Ok(Json(news))
}

/// Handler for fetching personalized news
pub async fn get_personalized_news(
    State(state): State<AppState>,
    Query(params): Query<PersonalizedNewsParams>,
) -> Result<Json<NewsResponse>, ApiError> {
    let tickers = params.tickers.map(|t| t.split(',').map(|s| s.trim().to_string()).collect());
    let topics = params.topics.map(|t| t.split(',').map(|s| s.trim().to_string()).collect());
    let limit = params.limit.unwrap_or(10);
    
    let news = state.news_service.get_personalized_news(
        tickers,
        topics,
        params.location,
        Some(limit)
    ).await?;
    
    Ok(Json(news))
}

/// Handler for fetching news with custom filters
pub async fn get_filtered_news(
    State(state): State<AppState>,
    Query(params): Query<NewsQueryParams>,
) -> Result<Json<NewsResponse>, ApiError> {
    let request = NewsRequest {
        tickers: None,
        tags: params.tags,
        categories: params.categories,
        start_date: None,
        end_date: None,
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
        location: params.location,
        topics: params.topics,
    };
    
    let news = state.news_service.get_news(&request).await?;
    
    Ok(Json(news))
}