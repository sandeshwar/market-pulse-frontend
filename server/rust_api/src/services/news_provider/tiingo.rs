use crate::models::error::ApiError;
use crate::models::news::{NewsArticle, NewsResponse, NewsRequest};
use reqwest::Client;
use serde::{Serialize, Deserialize};
use std::time::Duration;
use std::sync::Arc;
use chrono::{DateTime, Utc};

/// Helper function to convert a Tiingo news article to our internal model
fn convert_tiingo_article(article: TiingoNewsArticle) -> NewsArticle {
    // Combine tickers and tags into a single tags vector
    let mut all_tags = Vec::new();
    if let Some(tickers) = article.tickers {
        all_tags.extend(tickers);
    }
    if let Some(tags) = &article.tags {
        all_tags.extend(tags.clone());
    }

    // Create categories based on tags if available
    let categories = if let Some(tags) = &article.tags {
        tags.iter()
            .filter(|tag| {
                // Convert some common tags to categories
                tag.contains("earnings") ||
                tag.contains("market") ||
                tag.contains("economy") ||
                tag.contains("finance") ||
                tag.contains("tech") ||
                tag.contains("crypto")
            })
            .map(|s| s.to_string())
            .collect()
    } else {
        Vec::new()
    };

    NewsArticle {
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source,
        published_date: article.publishedDate,
        tags: all_tags,
        image_url: article.image_url,
        categories,
    }
}

/// Tiingo News API response structure
/// According to the documentation, the response is a direct array of articles
#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum TiingoNewsResponse {
    // Direct array of articles (standard response)
    Articles(Vec<TiingoNewsArticle>),
}

/// Tiingo News Article structure based on the API documentation
#[derive(Debug, Serialize, Deserialize)]
struct TiingoNewsArticle {
    /// Unique identifier specific to the news article
    #[serde(default)]
    id: Option<i32>,

    /// Title of the news article
    title: String,

    /// URL of the news article
    url: String,

    /// Long-form description of the news story
    #[serde(default)]
    description: Option<String>,

    /// The datetime the news story was published in UTC
    publishedDate: DateTime<Utc>,

    /// The datetime the news story was added to the database in UTC
    #[serde(default)]
    crawlDate: Option<DateTime<Utc>>,

    /// The domain the news source is from
    source: String,

    /// What tickers are mentioned in the news story
    #[serde(default)]
    tickers: Option<Vec<String>>,

    /// Tags that are mapped and discovered by Tiingo
    #[serde(default)]
    tags: Option<Vec<String>>,

    /// Image URL if available (not in official docs but appears in responses)
    #[serde(rename = "imageUrl", default)]
    image_url: Option<String>,
}

/// Tiingo News API client
#[derive(Clone)]
pub struct TiingoNewsClient {
    client: Arc<Client>,
    api_key: String,
    base_url: String,
}

impl TiingoNewsClient {
    /// Creates a new Tiingo News API client
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))  // Increased timeout for potentially slow responses
            .user_agent("Market Pulse/1.0")    // Set a user agent
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client: Arc::new(client),
            api_key,
            base_url: "https://api.tiingo.com/tiingo/news".to_string(),
        }
    }

    /// Fetches news articles based on the provided request parameters
    pub async fn fetch_news(&self, request: &NewsRequest) -> Result<NewsResponse, ApiError> {
        // Build query parameters according to Tiingo API documentation
        let mut query_params = vec![("token", self.api_key.clone())];

        // Add optional parameters if they exist
        if let Some(tickers) = &request.tickers {
            // Tiingo expects comma-separated tickers
            query_params.push(("tickers", tickers.clone()));
        }

        if let Some(tags) = &request.tags {
            // Tiingo expects comma-separated tags
            query_params.push(("tags", tags.clone()));
        }

        if let Some(start_date) = &request.start_date {
            // Format: YYYY-MM-DD
            query_params.push(("startDate", start_date.clone()));
        }

        if let Some(end_date) = &request.end_date {
            // Format: YYYY-MM-DD
            query_params.push(("endDate", end_date.clone()));
        }

        if let Some(limit) = &request.limit {
            // Number of results to return
            query_params.push(("limit", limit.to_string()));
        }

        if let Some(offset) = &request.offset {
            // Offset for pagination
            query_params.push(("offset", offset.to_string()));
        }

        if let Some(sort) = &request.sort {
            // Sort order, e.g., "publishedDate:desc"
            query_params.push(("sortBy", sort.clone()));
        }

        // Add source filter if provided
        if let Some(source) = &request.location {
            query_params.push(("source", source.clone()));
        }

        // Add format parameter to ensure we get JSON
        query_params.push(("format", "json".to_string()));
        
        // Log the request for debugging
        let request_url = format!("{}?{}", self.base_url,
            query_params.iter()
                .filter(|(k, _)| *k != "token") // Don't log the API key
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join("&")
        );
        tracing::debug!("Tiingo API request: {}", request_url);

        // Make the API request
        let response = self.client.as_ref().get(&self.base_url)
            .query(&query_params)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Tiingo API request failed: {}", e);
                ApiError::ExternalServiceError(format!("Tiingo News API request failed: {}", e))
            })?;
        
        // Check if the request was successful
        if !response.status().is_success() {
            let status = response.status();

            // Try to get detailed error information
            let error_text = match response.text().await {
                Ok(text) => {
                    // Try to parse as JSON error response
                    if let Ok(json_error) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(error_msg) = json_error.get("error") {
                            format!("API error: {}", error_msg)
                        } else {
                            text
                        }
                    } else {
                        text
                    }
                },
                Err(_) => "Unknown error".to_string()
            };

            tracing::error!("Tiingo API error: Status {}, Response: {}", status, error_text);

            // Handle specific status codes
            match status.as_u16() {
                401 => return Err(ApiError::ExternalServiceError(
                    "Tiingo API authentication failed. Please check your API key.".to_string()
                )),
                403 => return Err(ApiError::ExternalServiceError(
                    "Tiingo API access forbidden. Your account may not have access to this endpoint.".to_string()
                )),
                429 => return Err(ApiError::ExternalServiceError(
                    "Tiingo API rate limit exceeded. Please try again later.".to_string()
                )),
                _ => return Err(ApiError::ExternalServiceError(
                    format!("Tiingo News API returned error status {}: {}", status, error_text)
                ))
            }
        }

        // Get the response body
        let response_bytes = response.bytes().await
            .map_err(|e| ApiError::ExternalServiceError(format!("Failed to read Tiingo News API response: {}", e)))?;

        // For debugging, convert to string and log (but don't consume the bytes)
        if tracing::enabled!(tracing::Level::DEBUG) {
            if let Ok(text) = std::str::from_utf8(&response_bytes) {
                tracing::debug!("Tiingo API response: {}", text);
            }
        }

        // Parse the response directly from bytes
        let tiingo_response: TiingoNewsResponse = match serde_json::from_slice(&response_bytes) {
            Ok(response) => response,
            Err(e) => {
                // For error logging, try to get the response as text
                let error_text = std::str::from_utf8(&response_bytes)
                    .unwrap_or("(invalid UTF-8)");

                tracing::error!("Failed to parse Tiingo response: {}, Response: {}", e, error_text);

                // Try to parse as a single article (some endpoints might return a single object)
                if let Ok(single_article) = serde_json::from_slice::<TiingoNewsArticle>(&response_bytes) {
                    tracing::info!("Successfully parsed response as a single article");
                    TiingoNewsResponse::Articles(vec![single_article])
                } else {
                    return Err(ApiError::ExternalServiceError(
                        format!("Failed to parse Tiingo News API response: {}", e)
                    ));
                }
            }
        };

        // Convert to our internal model
        match tiingo_response {
            TiingoNewsResponse::Articles(articles) => {
                let original_count = articles.len();
                tracing::debug!("Received array response with {} articles", original_count);

                // Use a HashSet to track unique titles and filter out duplicates
                let mut unique_titles = std::collections::HashSet::new();
                let processed_articles: Vec<NewsArticle> = articles.into_iter()
                    .map(|article| convert_tiingo_article(article))
                    .filter(|article| unique_titles.insert(article.title.clone()))
                    .collect();

                let unique_count = processed_articles.len();
                if unique_count < original_count {
                    tracing::info!("Filtered out {} duplicate news articles", original_count - unique_count);
                }

                Ok(NewsResponse {
                    articles: processed_articles,
                    total_count: Some(unique_count), // Update count to reflect unique articles
                    next_cursor: None,
                })
            }
        }
    }
    
    /// Fetches news specifically for a ticker symbol
    pub async fn fetch_ticker_news(&self, ticker: &str, limit: Option<usize>) -> Result<NewsResponse, ApiError> {
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
        
        self.fetch_news(&request).await
    }
    
    /// Fetches trending news (most recent news without specific filters)
    pub async fn fetch_trending_news(&self, limit: Option<usize>) -> Result<NewsResponse, ApiError> {
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
        
        self.fetch_news(&request).await
    }
}