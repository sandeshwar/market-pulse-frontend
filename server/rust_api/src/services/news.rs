use crate::models::error::ApiError;
use crate::models::news::{NewsResponse, NewsRequest, NewsArticle};
use crate::services::news_provider::TiingoNewsClient;
use crate::services::redis::RedisManager;
use std::env;
use std::sync::Arc;
use chrono::{Utc, Duration};

/// News service for fetching and caching news data
#[derive(Clone)]
pub struct NewsService {
    news_client: Arc<TiingoNewsClient>,
    redis: Arc<RedisManager>,
    cache_duration: u64,
}

impl NewsService {
    /// Creates a new news service
    pub fn new(api_key: String, redis: Arc<RedisManager>) -> Self {
        // Get cache duration from environment or use default (15 minutes)
        let cache_duration = env::var("NEWS_CACHE_DURATION")
            .unwrap_or_else(|_| "900".to_string()) // 15 minutes default
            .parse::<u64>()
            .unwrap_or(900);

        // Create the Tiingo news client
        tracing::info!("Initializing Tiingo news client");
        let news_client = Arc::new(TiingoNewsClient::new(api_key));

        Self {
            news_client,
            redis,
            cache_duration,
        }
    }
    
    /// Generates a Redis key for news data
    fn generate_cache_key(&self, request: &NewsRequest) -> String {
        let mut key_parts = vec!["news".to_string()];
        
        if let Some(tickers) = &request.tickers {
            key_parts.push(format!("tickers:{}", tickers));
        }
        
        if let Some(tags) = &request.tags {
            key_parts.push(format!("tags:{}", tags));
        }
        
        if let Some(categories) = &request.categories {
            key_parts.push(format!("categories:{}", categories));
        }
        
        if let Some(limit) = &request.limit {
            key_parts.push(format!("limit:{}", limit));
        }
        
        if let Some(sort) = &request.sort {
            key_parts.push(format!("sort:{}", sort));
        }
        
        if let Some(location) = &request.location {
            key_parts.push(format!("location:{}", location));
        }
        
        if let Some(topics) = &request.topics {
            key_parts.push(format!("topics:{}", topics));
        }
        
        key_parts.join(":")
    }
    
    /// Fetches news data with caching
    pub async fn get_news(&self, request: &NewsRequest) -> Result<NewsResponse, ApiError> {
        let cache_key = self.generate_cache_key(request);
        
        // Try to get from cache first
        match self.redis.get::<NewsResponse>(&cache_key).await {
            Ok(Some(cached_news)) => {
                tracing::debug!("News cache hit for key: {}", cache_key);
                return Ok(cached_news);
            }
            Ok(None) => {
                tracing::debug!("News cache miss for key: {}", cache_key);
            }
            Err(e) => {
                tracing::error!("Redis error when fetching news: {}", e);
                // Continue with API call on Redis error
            }
        }
        
        // Cache miss, fetch from API
        let news_data = self.news_client.fetch_news(request).await?;
        
        // Cache the result
        if let Err(e) = self.redis.set(&cache_key, &news_data, Some(self.cache_duration as usize)).await {
            tracing::error!("Failed to cache news data: {}", e);
            // Continue even if caching fails
        }
        
        Ok(news_data)
    }
    
    /// Fetches news for a specific ticker symbol
    pub async fn get_ticker_news(&self, ticker: &str, limit: Option<usize>) -> Result<NewsResponse, ApiError> {
        let request = NewsRequest {
            tickers: Some(ticker.to_string()),
            tags: None,
            categories: None,
            start_date: None,
            end_date: None,
            limit,
            offset: None,
            sort: Some("publishedDate:desc".to_string()),
            location: None,
            topics: None,
        };
        
        self.get_news(&request).await
    }
    
    /// Fetches trending news
    pub async fn get_trending_news(&self, limit: Option<usize>) -> Result<NewsResponse, ApiError> {
        let request = NewsRequest {
            tickers: None,
            tags: None,
            categories: None,
            start_date: None,
            end_date: None,
            limit,
            offset: None,
            sort: Some("publishedDate:desc".to_string()),
            location: None,
            topics: None,
        };
        
        self.get_news(&request).await
    }
    
    /// Fetches personalized news based on user preferences
    pub async fn get_personalized_news(
        &self, 
        tickers: Option<Vec<String>>, 
        topics: Option<Vec<String>>,
        location: Option<String>,
        limit: Option<usize>
    ) -> Result<NewsResponse, ApiError> {
        let request = NewsRequest {
            tickers: tickers.map(|t| t.join(",")),
            tags: topics.clone().map(|t| t.join(",")),
            categories: None,
            start_date: None,
            end_date: None,
            limit,
            offset: None,
            sort: Some("publishedDate:desc".to_string()),
            location,
            topics: topics.map(|t| t.join(",")),
        };
        
        self.get_news(&request).await
    }
}