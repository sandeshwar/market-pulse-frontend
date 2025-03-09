import { MarketDataAppProvider } from './providers/MarketDataAppProvider';
import { DEFAULT_REFRESH_INTERVAL } from '../constants/marketConstants.js';

/**
 * Service class for handling market data operations
 */
export class MarketDataService {
  constructor() {
    this.lastUpdateTime = null;
    this.cachedData = null;
    this.provider = new MarketDataAppProvider();
  }

  /**
   * Gets the list of available market indices
   * @returns {Promise<Array>} List of market indices
   */
  async getAvailableIndices() {
    try {
      if (this.cachedData && 
          this.lastUpdateTime && 
          Date.now() - this.lastUpdateTime < DEFAULT_REFRESH_INTERVAL) {
        return this.cachedData;
      }

      const quotes = await this.provider.getMarketIndices();
      this.cachedData = quotes;
      this.lastUpdateTime = Date.now();
      return quotes;
    } catch (error) {
      console.error('MarketDataService error:', error);
      throw error;
    }
  }

  /**
   * Clears the cached market data
   */
  clearCache() {
    this.cachedData = null;
    this.lastUpdateTime = null;
  }
}

// Export a singleton instance
export const marketDataService = new MarketDataService();
