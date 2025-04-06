import { MarketDataNewsProviderInterface } from './MarketDataNewsProvider.interface.js';
import { config } from '../config.js';

export class MarketDataNewsProvider extends MarketDataNewsProviderInterface {
  constructor() {
    super();
    // Extract the base URL from config.API_URL
    let baseUrl = config.API_URL || 'http://localhost:3100/api/';

    // Make sure the URL doesn't end with 'market-data/'
    baseUrl = baseUrl.replace(/market-data\/$/, '');

    // Make sure the URL ends with a slash
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }

    this.apiUrl = baseUrl;
  }

  /**
   * Safely converts a published date to a timestamp in seconds
   * @param {string} publishedDate - The date string from the API
   * @returns {number} - Timestamp in seconds
   */
  _safelyConvertDate(publishedDate) {
    if (!publishedDate) {
      return Date.now() / 1000; // Current time in seconds
    }

    try {
      const timestamp = new Date(publishedDate).getTime();
      if (isNaN(timestamp)) {
        console.warn('Invalid date format:', publishedDate);
        return Date.now() / 1000;
      }
      return timestamp / 1000; // Convert to seconds
    } catch (error) {
      console.warn('Error parsing date:', publishedDate, error);
      return Date.now() / 1000;
    }
  }

  /**
   * Fetches news for a specific stock symbol
   * @param {string} symbol - The stock symbol to fetch news for
   * @param {number} limit - Maximum number of news articles to return
   * @returns {Promise<Object>} - News data for the symbol
   */
  async getStockNews(symbol, limit = 8) {
    try {
      const response = await fetch(
        `${this.apiUrl}market-data/news/ticker/${symbol}?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch news for ${symbol}`);
      }

      const data = await response.json();

      // Format for the BreakingNews component
      return {
        symbol,
        news: data.articles.map(item => ({
          headline: item.title,
          description: item.description || '',
          url: item.url,
          source: item.url, // BreakingNews expects the URL in the source field
          updated: this._safelyConvertDate(item.published_date),
          imageUrl: item.image_url,
          tags: item.tags || []
        }))
      };
    } catch (error) {
      console.error('News API error:', error);
      // Return empty news array on error
      return {
        symbol,
        news: []
      };
    }
  }

  /**
   * Fetches trending news articles
   * @param {number} limit - Maximum number of news articles to return
   * @returns {Promise<Object>} - Trending news data
   */
  async getTrendingNews(limit = 10) {
    try {
      const response = await fetch(
        `${this.apiUrl}market-data/news/trending?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trending news');
      }

      const data = await response.json();

      return {
        news: data.articles.map(item => ({
          headline: item.title,
          description: item.description || '',
          url: item.url,
          source: item.url, // For consistency with getStockNews
          updated: this._safelyConvertDate(item.published_date),
          imageUrl: item.image_url,
          tags: item.tags || []
        }))
      };
    } catch (error) {
      console.error('News API error:', error);
      // Return empty news array on error
      return {
        news: []
      };
    }
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
    try {
      const queryParams = new URLSearchParams();

      if (tickers.length > 0) {
        queryParams.append('tickers', tickers.join(','));
      }

      if (topics.length > 0) {
        queryParams.append('topics', topics.join(','));
      }

      if (location) {
        queryParams.append('location', location);
      }

      queryParams.append('limit', limit.toString());

      const response = await fetch(
        `${this.apiUrl}market-data/news/personalized?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch personalized news');
      }

      const data = await response.json();

      return {
        news: data.articles.map(item => ({
          headline: item.title,
          description: item.description || '',
          url: item.url,
          source: item.url, // For consistency
          updated: this._safelyConvertDate(item.published_date),
          imageUrl: item.image_url,
          tags: item.tags || []
        }))
      };
    } catch (error) {
      console.error('News API error:', error);
      // Return empty news array on error
      return {
        news: []
      };
    }
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
    try {
      const queryParams = new URLSearchParams();

      if (tags.length > 0) {
        queryParams.append('tags', tags.join(','));
      }

      if (categories.length > 0) {
        queryParams.append('categories', categories.join(','));
      }

      queryParams.append('limit', limit.toString());

      const response = await fetch(
        `${this.apiUrl}market-data/news/filtered?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch filtered news');
      }

      const data = await response.json();

      return {
        news: data.articles.map(item => ({
          headline: item.title,
          description: item.description || '',
          url: item.url,
          source: item.url, // For consistency
          updated: this._safelyConvertDate(item.published_date),
          imageUrl: item.image_url,
          tags: item.tags || []
        }))
      };
    } catch (error) {
      console.error('News API error:', error);
      // Return empty news array on error
      return {
        news: []
      };
    }
  }
}