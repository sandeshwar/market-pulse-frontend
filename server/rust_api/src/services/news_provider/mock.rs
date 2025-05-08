use crate::models::error::ApiError;
use crate::models::news::{NewsArticle, NewsResponse, NewsRequest};
use chrono::{Utc, Duration};
use rand::{Rng, seq::SliceRandom};

/// Mock news client for providing news data
pub struct MockNewsClient {
    /// Whether to simulate errors
    pub simulate_errors: bool,

    /// Whether to simulate network delays
    pub simulate_delays: bool,

    /// Minimum delay in milliseconds
    pub min_delay_ms: u64,

    /// Maximum delay in milliseconds
    pub max_delay_ms: u64,
}

impl MockNewsClient {
    /// Creates a new mock news client
    pub fn new() -> Self {
        Self {
            simulate_errors: false,
            simulate_delays: true,
            min_delay_ms: 100,
            max_delay_ms: 500,
        }
    }

    /// Simulates a network delay if enabled
    async fn simulate_delay(&self) {
        if self.simulate_delays {
            let delay_ms = rand::thread_rng().gen_range(self.min_delay_ms..=self.max_delay_ms);
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }
    }
    
    /// Fetches mock news data
    pub async fn fetch_news(&self, request: &NewsRequest) -> Result<NewsResponse, ApiError> {
        // Simulate network delay
        self.simulate_delay().await;

        // Simulate errors if enabled
        if self.simulate_errors {
            return Err(ApiError::ExternalServiceError("Simulated error".to_string()));
        }

        // Log the request for debugging
        tracing::debug!("Mock news provider received request: {:?}", request);
        
        // Generate mock news articles
        let mut articles = Vec::new();
        let limit = request.limit.unwrap_or(10);
        
        // Generate ticker-specific news if tickers are provided
        if let Some(tickers_str) = &request.tickers {
            let tickers: Vec<&str> = tickers_str.split(',').collect();
            
            for ticker in tickers {
                articles.extend(self.generate_ticker_news(ticker, limit / tickers.len().max(1)));
            }
        } else {
            // Generate general news
            articles.extend(self.generate_general_news(limit));
        }
        
        // Apply tags filter if provided
        if let Some(tags_str) = &request.tags {
            let tags: Vec<&str> = tags_str.split(',').collect();
            articles.retain(|article| {
                article.tags.iter().any(|tag| tags.contains(&tag.as_str()))
            });
        }
        
        // Apply categories filter if provided
        if let Some(categories_str) = &request.categories {
            let categories: Vec<&str> = categories_str.split(',').collect();
            articles.retain(|article| {
                article.categories.iter().any(|cat| categories.contains(&cat.as_str()))
            });
        }
        
        // Sort by date if requested
        if let Some(sort) = &request.sort {
            if sort.contains("publishedDate:desc") {
                articles.sort_by(|a, b| b.published_date.cmp(&a.published_date));
            } else if sort.contains("publishedDate:asc") {
                articles.sort_by(|a, b| a.published_date.cmp(&b.published_date));
            }
        }
        
        // Apply limit
        if articles.len() > limit {
            articles.truncate(limit);
        }
        
        Ok(NewsResponse {
            articles,
            total_count: Some(articles.len()),
            next_cursor: None,
        })
    }
    
    /// Generates mock news for a specific ticker
    fn generate_ticker_news(&self, ticker: &str, count: usize) -> Vec<NewsArticle> {
        let mut rng = rand::thread_rng();
        let now = Utc::now();
        
        let headlines = [
            format!("{} Reports Strong Quarterly Earnings", ticker),
            format!("{} Announces New Product Line", ticker),
            format!("Analysts Upgrade {} Stock Rating", ticker),
            format!("{} CEO Discusses Future Growth Plans", ticker),
            format!("{} Expands into New Markets", ticker),
            format!("Investors React to {} Latest Announcement", ticker),
            format!("{} Stock Rises on Positive News", ticker),
            format!("What's Next for {}? Experts Weigh In", ticker),
            format!("{} Partners with Industry Leader", ticker),
            format!("Breaking: Major Development at {}", ticker),
        ];
        
        let sources = [
            "marketwatch.com",
            "bloomberg.com",
            "cnbc.com",
            "reuters.com",
            "wsj.com",
            "fool.com",
            "investopedia.com",
            "barrons.com",
            "seekingalpha.com",
            "finance.yahoo.com",
        ];
        
        let descriptions = [
            format!("The latest quarterly report from {} shows significant growth in key areas.", ticker),
            format!("{} has announced plans to expand its product offerings in the coming months.", ticker),
            format!("Financial analysts have revised their outlook on {} following recent developments.", ticker),
            format!("In a recent interview, the CEO of {} outlined the company's strategic vision.", ticker),
            format!("{} is entering new markets as part of its global expansion strategy.", ticker),
            format!("Investors are responding positively to the latest news from {}.", ticker),
            format!("Shares of {} have seen increased trading volume after recent announcements.", ticker),
            format!("Industry experts share their predictions for the future of {}.", ticker),
            format!("{} has formed a strategic partnership that could drive future growth.", ticker),
            format!("Breaking news about {} is causing significant market movement.", ticker),
        ];
        
        let tags = vec![
            ticker.to_string(),
            "stocks".to_string(),
            "markets".to_string(),
            "investing".to_string(),
            "finance".to_string(),
        ];
        
        let categories = vec![
            "earnings".to_string(),
            "company-news".to_string(),
            "market-news".to_string(),
            "analysis".to_string(),
        ];
        
        let mut articles = Vec::new();
        
        for i in 0..count {
            let headline_idx = i % headlines.len();
            let source_idx = rng.gen_range(0..sources.len());
            let desc_idx = i % descriptions.len();
            
            // Generate a random time within the last week
            let days_ago = rng.gen_range(0..7);
            let hours_ago = rng.gen_range(0..24);
            let published_date = now - Duration::days(days_ago) - Duration::hours(hours_ago);
            
            // Select random tags and categories
            let mut article_tags = tags.clone();
            article_tags.shuffle(&mut rng);
            article_tags.truncate(rng.gen_range(1..4));
            
            let mut article_categories = categories.clone();
            article_categories.shuffle(&mut rng);
            article_categories.truncate(rng.gen_range(1..3));
            
            // Create a realistic-looking news article
            articles.push(NewsArticle {
                title: headlines[headline_idx].clone(),
                description: Some(descriptions[desc_idx].clone()),
                url: format!("https://{}/news/{}", sources[source_idx], ticker.to_lowercase()),
                source: sources[source_idx].to_string(),
                published_date,
                tags: article_tags,
                image_url: Some(format!("https://example.com/images/{}.jpg", ticker.to_lowercase())),
                categories: article_categories,
            });
        }
        
        articles
    }
    
    /// Generates general mock news
    fn generate_general_news(&self, count: usize) -> Vec<NewsArticle> {
        let mut rng = rand::thread_rng();
        let now = Utc::now();
        
        let headlines = [
            "Markets React to Federal Reserve Announcement",
            "Global Economic Outlook: What to Expect",
            "Tech Stocks Lead Market Rally",
            "Inflation Data Impacts Market Sentiment",
            "Cryptocurrency Market Sees Volatility",
            "Oil Prices Fluctuate Amid Global Tensions",
            "Retail Sector Shows Signs of Recovery",
            "Banking Stocks Respond to Regulatory Changes",
            "Healthcare Sector: Innovations and Investments",
            "Supply Chain Issues Continue to Affect Markets",
        ];
        
        let sources = [
            "marketwatch.com",
            "bloomberg.com",
            "cnbc.com",
            "reuters.com",
            "wsj.com",
            "fool.com",
            "investopedia.com",
            "barrons.com",
            "seekingalpha.com",
            "finance.yahoo.com",
        ];
        
        let descriptions = [
            "Investors are closely watching the Federal Reserve's latest policy decisions and their potential impact on markets.",
            "Analysts provide insights on what to expect from the global economy in the coming months.",
            "Technology companies are leading the latest market rally, with several stocks reaching new highs.",
            "The latest inflation data has influenced market sentiment and trading patterns.",
            "The cryptocurrency market continues to experience significant price fluctuations.",
            "Geopolitical tensions are contributing to volatility in global oil prices.",
            "After a challenging period, the retail sector is showing promising signs of recovery.",
            "Recent regulatory changes are affecting banking stocks and financial institutions.",
            "The healthcare sector is seeing increased investment in innovative technologies and treatments.",
            "Ongoing supply chain disruptions continue to impact various market sectors.",
        ];
        
        let tags = vec![
            "markets".to_string(),
            "economy".to_string(),
            "investing".to_string(),
            "finance".to_string(),
            "stocks".to_string(),
            "commodities".to_string(),
            "crypto".to_string(),
            "tech".to_string(),
            "retail".to_string(),
            "banking".to_string(),
            "healthcare".to_string(),
        ];
        
        let categories = vec![
            "market-news".to_string(),
            "economy".to_string(),
            "analysis".to_string(),
            "trends".to_string(),
            "global".to_string(),
        ];
        
        let mut articles = Vec::new();
        
        for i in 0..count {
            let headline_idx = i % headlines.len();
            let source_idx = rng.gen_range(0..sources.len());
            let desc_idx = i % descriptions.len();
            
            // Generate a random time within the last week
            let days_ago = rng.gen_range(0..7);
            let hours_ago = rng.gen_range(0..24);
            let published_date = now - Duration::days(days_ago) - Duration::hours(hours_ago);
            
            // Select random tags and categories
            let mut article_tags = tags.clone();
            article_tags.shuffle(&mut rng);
            article_tags.truncate(rng.gen_range(2..5));
            
            let mut article_categories = categories.clone();
            article_categories.shuffle(&mut rng);
            article_categories.truncate(rng.gen_range(1..3));
            
            // Create a realistic-looking general news article
            articles.push(NewsArticle {
                title: headlines[headline_idx].to_string(),
                description: Some(descriptions[desc_idx].to_string()),
                url: format!("https://{}/news/{}", sources[source_idx], headline_idx),
                source: sources[source_idx].to_string(),
                published_date,
                tags: article_tags,
                image_url: Some(format!("https://example.com/images/news{}.jpg", headline_idx)),
                categories: article_categories,
            });
        }
        
        articles
    }
}