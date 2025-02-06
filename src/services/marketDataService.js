import { DEFAULT_REFRESH_INTERVAL } from '../constants/marketConstants.js';

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

// Alpha Vantage API key
const API_KEY = 'GJP7OUPYQV4YE63G';

// Mock data for fallback
const MOCK_DATA = [
  {
    name: 'S&P 500',
    value: 4927.93,
    change: 25.61,
    changePercent: 0.52
  },
  {
    name: 'Dow Jones',
    value: 38654.42,
    change: 134.58,
    changePercent: 0.35
  },
  {
    name: 'NASDAQ',
    value: 15628.95,
    change: 78.21,
    changePercent: 0.50
  },
  {
    name: 'Russell 2000',
    value: 1998.65,
    change: -3.26,
    changePercent: -0.16
  },
  {
    name: 'VIX',
    value: 13.85,
    change: -0.26,
    changePercent: -1.84
  }
];

/**
 * Service class for handling market data operations
 */
export class MarketDataService {
  constructor() {
    this.lastUpdateTime = null;
    this.cachedData = null;
    this.useMockData = false; // Set to false to use real data
  }

  /**
   * Gets the list of available market indices
   * @returns {Promise<Array>} List of market indices
   */
  async getAvailableIndices() {
    try {
      // Return mock data if enabled
      // if (this.useMockData) {
      //   return MOCK_DATA;
      // }

      // Check if we have valid cached data
      if (this.cachedData && 
          this.lastUpdateTime && 
          Date.now() - this.lastUpdateTime < DEFAULT_REFRESH_INTERVAL) {
        return this.cachedData;
      }

      // Fetch data for each symbol individually to avoid rate limits
      const quotes = await Promise.all(
        MARKET_INDICES.map(async (symbol) => {
          try {
            const response = await fetch(
              `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`,
              {
                headers: {
                  'Accept': 'application/json'
                }
              }
            );

            if (!response.ok) {
              throw new Error(`Failed to fetch data for ${symbol}`);
            }

            const data = await response.json();

            if (!data['Global Quote']) {
              console.warn(`No data available for ${symbol}`);
              return null;
            }

            const quote = data['Global Quote'];
            const price = parseFloat(quote['05. price']);
            const change = parseFloat(quote['09. change']);
            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

            if (isNaN(price) || isNaN(change) || isNaN(changePercent)) {
              console.warn(`Invalid data for ${symbol}`);
              return null;
            }

            return {
              name: INDEX_NAMES[symbol],
              value: price,
              change: change,
              changePercent: changePercent
            };
          } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
            return null;
          }
        })
      );

      // Filter out any failed requests
      const validQuotes = quotes.filter(quote => quote !== null);

      if (validQuotes.length === 0) {
        throw new Error('Unable to fetch any market data');
      }

      // Update cache
      this.cachedData = validQuotes;
      this.lastUpdateTime = Date.now();

      return validQuotes;
    } catch (error) {
      console.error('MarketDataService error:', error);
      
      // Return mock data as fallback
      return MOCK_DATA;
    }
  }

  /**
   * Clears the cached market data
   */
  clearCache() {
    this.cachedData = null;
    this.lastUpdateTime = null;
  }

  /**
   * Enable/disable mock data
   */
  setUseMockData(value) {
    this.useMockData = value;
    this.clearCache();
  }
}

// Export a singleton instance
export const marketDataService = new MarketDataService();