import { MarketDataProvider } from './MarketDataProvider.interface';
import { MARKET_INDICES } from '../../constants/marketConstants.js';

export class MarketDataAppProvider extends MarketDataProvider {
  constructor() {
    super();
    this.apiKey = 'VG1hV1pNclRSeUYtZ2N1S2kyeXhvanBKbloyUTVtVGl6a2VjemNpazFyYz0';
    this.searchCache = new Map(); // Cache search results
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.symbols = [];
    this.lastUpdate = 0;
    this.updateInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
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

  async initializeSymbols() {
    if (Date.now() - this.lastUpdate < this.updateInterval && this.symbols.length > 0) {
      return;
    }

    try {
      // Fetch full listing once and store locally
      const response = await fetch(
        `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${this.apiKey}&state=active`
      );
      const csv = await response.text();
      
      // Parse CSV (skip header)
      this.symbols = csv.split('\n')
        .slice(1)
        .map(line => {
          const [symbol, name, exchange, assetType] = line.split(',');
          return { symbol, name, exchange, type: assetType };
        })
        .filter(item => item.symbol); // Remove empty entries

      this.lastUpdate = Date.now();
      
      // Store in localStorage for persistence
      localStorage.setItem('stockSymbols', JSON.stringify({
        timestamp: this.lastUpdate,
        data: this.symbols
      }));
    } catch (error) {
      console.error('Error fetching symbols:', error);
      // Try to load from localStorage if fetch fails
      const cached = localStorage.getItem('stockSymbols');
      if (cached) {
        const { data } = JSON.parse(cached);
        this.symbols = data;
      }
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

        // Fetch from our server
        const response = await fetch(
            `https://your-server.com/api/symbols/search?q=${encodeURIComponent(query)}`
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