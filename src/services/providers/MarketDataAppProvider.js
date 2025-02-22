import { MarketDataProvider } from './MarketDataProvider.interface';
import { MARKET_INDICES } from '../../constants/marketConstants.js';
import { config } from '../../config.js';

export class MarketDataAppProvider extends MarketDataProvider {
  constructor() {
    super();
    this.apiKey = config.API_KEY;
    this.searchCache = new Map(); // Cache search results
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  async getMarketIndices() {
    try {
      // Make individual requests for each index
      const promises = Object.keys(MARKET_INDICES).map(async (symbol) => {
        const response = await fetch(
          `https://api.marketdata.app/v1/indices/quotes/${symbol}?token=${this.apiKey}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch data for ${symbol}`);
          return null;
        }

        const data = await response.json();
        
        // Handle the single index response
        if (data.s !== 'ok') {
          console.warn(`Invalid response for ${symbol}`);
          return null;
        }

        // Indices endpoint returns last instead of c for current price
        const price = parseFloat(data.last?.[0]);
        const change = parseFloat(data.ch?.[0] || 0); // Change might not be provided
        const changePercent = parseFloat(data.chp?.[0] || 0);

        if (isNaN(price)) {
          console.warn(`Invalid numeric data for ${symbol}`);
          return null;
        }

        return {
          name: MARKET_INDICES[symbol],
          value: price,
          change: change || 0,
          changePercent: changePercent || 0
        };
      });

      const results = await Promise.all(promises);
      const validQuotes = results.filter(quote => quote !== null);

      if (validQuotes.length === 0) {
        throw new Error('Unable to fetch any market data');
      }

      return validQuotes;
    } catch (error) {
      console.error('MarketData.app error:', error);
      throw error;
    }
  }

  async searchSymbols(query) {
    try {
        // Check cache first
        const cacheKey = query.toLowerCase();
        const cached = this.searchCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
            return cached.results;
        }

        // Fetch from our server using configured API_URL
        const response = await fetch(
            `${config.API_URL}symbols/search?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();

        // Cache the results
        this.searchCache.set(cacheKey, {
            timestamp: Date.now(),
            results: data.results
        });

        return data.results;
    } catch (error) {
        console.error('Error searching symbols:', error);
        return [];
    }
  }
}

export const marketDataProvider = new MarketDataAppProvider();