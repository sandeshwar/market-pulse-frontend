use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

/// News article model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsArticle {
    /// Article title
    pub title: String,
    
    /// Article description or snippet
    pub description: Option<String>,
    
    /// URL to the full article
    pub url: String,
    
    /// Source of the article
    pub source: String,
    
    /// Publication date
    pub published_date: DateTime<Utc>,
    
    /// Tags associated with the article (e.g., tickers, topics)
    pub tags: Vec<String>,
    
    /// Image URL if available
    pub image_url: Option<String>,
    
    /// Article categories (e.g., earnings, market-news)
    pub categories: Vec<String>,
}

/// News response model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsResponse {
    /// List of news articles
    pub articles: Vec<NewsArticle>,
    
    /// Total number of articles available (for pagination)
    pub total_count: Option<usize>,
    
    /// Cursor for pagination if applicable
    pub next_cursor: Option<String>,
}

/// News request parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsRequest {
    /// Ticker symbols to filter news by (comma-separated)
    pub tickers: Option<String>,
    
    /// Tags to filter news by (comma-separated)
    pub tags: Option<String>,
    
    /// Categories to filter news by (comma-separated)
    pub categories: Option<String>,
    
    /// Start date for news articles
    pub start_date: Option<String>,
    
    /// End date for news articles
    pub end_date: Option<String>,
    
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