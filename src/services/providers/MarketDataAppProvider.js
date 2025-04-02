import { MARKET_INDICES } from '../../constants/marketConstants.js';
import { config } from '../../config.js';

export class MarketDataAppProvider {
  constructor() {
    this.initialized = false;
    this.searchCache = new Map(); // Cache search results
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  async initialize() {
    if (this.initialized) return;

    this.apiKey = config.API_KEY;

    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    this.initialized = true;
  }

  async getMarketIndices() {
    try {
      await this.initialize();

      // Use our dedicated market indices API endpoint
      const response = await fetch(
        `${config.API_URL}indices`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication error');
        }
        throw new Error(`Failed to fetch market indices: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.indices) {
        throw new Error('Invalid response format from indices API');
      }

      // Transform the response to match our expected format
      const validQuotes = Object.entries(data.indices).map(([symbol, index]) => {
        // Only include indices that are in our MARKET_INDICES constant
        if (!MARKET_INDICES[symbol]) {
          return null;
        }

        return {
          name: MARKET_INDICES[symbol],
          value: index.value,
          change: index.change,
          changePercent: index.percent_change
        };
      }).filter(quote => quote !== null);

      if (validQuotes.length === 0) {
        throw new Error('No valid market indices data received');
      }

      return validQuotes;
    } catch (error) {
      console.error('Market indices API error:', error);
      throw error;
    }
  }

  async getMultipleStocks(symbols) {
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      console.warn('Invalid symbols parameter:', symbols);
      return {};
    }

    try {
      await this.initialize();

      // Join all symbols with commas for the API request
      const symbolsParam = symbols.join(',');

      // Use our dedicated stocks API endpoint with multiple symbols
      const response = await fetch(
        `${config.API_URL}stocks?symbols=${symbolsParam}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication error');
        }
        console.warn(`Failed to fetch quotes for [${symbolsParam}]: ${response.status}`);
        return {};
      }

      const data = await response.json();

      if (!data || !data.prices) {
        console.warn(`No data returned for [${symbolsParam}]`);
        return {};
      }

      // Process all returned symbols
      const result = {};

      // Iterate through the requested symbols to maintain order and handle missing data
      for (const symbol of symbols) {
        const symbolData = data.prices[symbol];

        // Skip if no data for this symbol
        if (!symbolData) {
          console.warn(`No data returned for ${symbol}`);
          continue;
        }

        const price = parseFloat(symbolData.price);
        const change = parseFloat(symbolData.change || 0);
        const changePercent = parseFloat(symbolData.percent_change || 0);
        // Use the symbol as name if not provided
        const name = symbolData.name || symbol;

        if (isNaN(price)) {
          console.warn(`Invalid numeric data for ${symbol}`);
          continue;
        }

        result[symbol] = {
          name,
          price,
          change,
          changePercent
        };
      }

      return result;
    } catch (error) {
      console.error(`Error fetching quotes for [${symbols.join(',')}]:`, error);
      throw error;
    }
  }

  async searchSymbols(query) {
    // Validate input
    if (!query || typeof query !== 'string') {
      console.warn('Invalid query parameter:', query);
      return [];
    }

    try {
      await this.initialize();

      // Check cache first
      const cacheKey = query.toLowerCase().trim();
      const cached = this.searchCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        return cached.results;
      }

      try {
        // Fetch from our server using the correct API endpoint
        // The symbols search endpoint is at /api/symbols/search or /api/symbols/cache/search
        // We need to remove 'market-data/' from the path
        const baseUrl = config.API_URL.replace('market-data/', '');
        const response = await fetch(
          `${baseUrl}symbols/cache/search?query=${encodeURIComponent(query)}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            credentials: 'omit' // Don't send cookies for cross-origin requests
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // The symbol cache endpoint returns an array directly, not wrapped in a results property
        if (!data) {
          console.warn('Invalid response format from symbols search');
          throw new Error('Invalid response format');
        }

        // Handle both formats: direct array or {results: [...]} object
        const results = Array.isArray(data) ? data : (data.results || []);

        // Cache the results
        this.searchCache.set(cacheKey, {
          timestamp: Date.now(),
          results: results
        });

        return results;
      } catch (apiError) {
        console.warn('API search failed:', apiError);
        return []; // Return empty array on API error
      }
    } catch (error) {
      console.error('Error searching symbols:', error);
      return []; // Return empty array on any error
    }
  }
}

export const marketDataProvider = new MarketDataAppProvider();