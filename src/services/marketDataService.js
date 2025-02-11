import { MarketDataAppProvider } from './providers/MarketDataAppProvider';

// List of major market indices we want to track with their symbols
const MARKET_INDICES = [
  'SPY',   // S&P 500 ETF
  'DIA',   // Dow Jones ETF
  'QQQ',   // NASDAQ ETF
  'IWM',   // Russell 2000 ETF
  'VIX',   // Volatility Index
];

// Map symbols to display names
const INDEX_NAMES = {
  'SPY': 'S&P 500',
  'DIA': 'Dow Jones',
  'QQQ': 'NASDAQ',
  'IWM': 'Russell 2000',
  'VIX': 'VIX',
};

// Default refresh interval (5 minutes)
export const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000;

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