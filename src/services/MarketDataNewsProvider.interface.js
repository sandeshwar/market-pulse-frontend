export class MarketDataNewsProviderInterface {
  /**
   * Fetches news for a specific stock symbol
   * @param {string} symbol - The stock symbol to fetch news for
   * @param {number} limit - Maximum number of news articles to return
   * @returns {Promise<Object>} - News data for the symbol
   */
  async getStockNews(symbol, limit = 5) {
    throw new Error('Not implemented');
  }

  /**
   * Fetches trending news articles
   * @param {number} limit - Maximum number of news articles to return
   * @returns {Promise<Object>} - Trending news data
   */
  async getTrendingNews(limit = 10) {
    throw new Error('Not implemented');
  }

  /**
   * Fetches personalized news based on user preferences
   * @param {Object} options - Personalization options
   * @param {Array<string>} options.tickers - List of ticker symbols
   * @param {Array<string>} options.topics - List of topics of interest
   * @param {string} options.location - User's location
   * @param {number} options.limit - Maximum number of news articles to return
   * @returns {Promise<Object>} - Personalized news data
   */
  async getPersonalizedNews({ tickers = [], topics = [], location = '', limit = 10 } = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Fetches filtered news based on specific criteria
   * @param {Object} filters - Filter criteria
   * @param {Array<string>} filters.tags - Tags to filter by
   * @param {Array<string>} filters.categories - Categories to filter by
   * @param {number} filters.limit - Maximum number of news articles to return
   * @returns {Promise<Object>} - Filtered news data
   */
  async getFilteredNews({ tags = [], categories = [], limit = 10 } = {}) {
    throw new Error('Not implemented');
  }
} 