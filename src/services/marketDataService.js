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

// API Keys
const API_KEYS = {
  marketdataapp: 'VG1hV1pNclRSeUYtZ2N1S2kyeXhvanBKbloyUTVtVGl6a2VjemNpazFyYz0',
  alphavantage: 'GJP7OUPYQV4YE63G'
};

/**
 * Service class for handling market data operations
 */
export class MarketDataService {
  constructor() {
    this.lastUpdateTime = null;
    this.cachedData = null;
    this.providers = {
      marketdataapp: new MarketDataAppProvider(),
    };
    
    // Initialize with MarketData.app as default
    this.activeProvider = this.providers.marketdataapp;
    this.activeProvider.setConfig({ apiKey: API_KEYS.marketdataapp });
  }

  /**
   * Initialize a provider with configuration
   * @param {string} providerName 
   * @param {Object} config 
   */
  initProvider(providerName, config) {
    if (!this.providers[providerName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    this.providers[providerName].setConfig(config);
    this.activeProvider = this.providers[providerName];
    this.clearCache();
  }

  /**
   * Switch to a different provider
   * @param {string} providerName 
   */
  switchProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    
    // Use stored API key for the provider
    const config = { apiKey: API_KEYS[providerName] };
    this.initProvider(providerName, config);
  }

  /**
   * Get available providers and their configuration requirements
   * @returns {Object} Map of provider names to their config requirements
   */
  getAvailableProviders() {
    const providers = {};
    for (const [key, provider] of Object.entries(this.providers)) {
      providers[key] = {
        name: provider.getName(),
        configRequirements: provider.getConfigRequirements(),
        isActive: provider === this.activeProvider
      };
    }
    return providers;
  }

  /**
   * Gets the list of available market indices
   * @returns {Promise<Array>} List of market indices
   */
  async getAvailableIndices() {
    try {
      if (!this.activeProvider || !this.activeProvider.isReady()) {
        throw new Error('No active provider configured');
      }

      if (this.cachedData && 
          this.lastUpdateTime && 
          Date.now() - this.lastUpdateTime < DEFAULT_REFRESH_INTERVAL) {
        return this.cachedData;
      }

      const quotes = await this.activeProvider.getMarketIndices();
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

  /**
   * Get current provider name
   */
  getCurrentProvider() {
    return this.activeProvider ? this.activeProvider.getName() : 'None';
  }
}

// Export a singleton instance
export const marketDataService = new MarketDataService();