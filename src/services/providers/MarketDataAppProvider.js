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

      // Use our Rust API to fetch all market indices at once
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

  async getQuote(symbol) {
    try {
      await this.initialize();
      
      const response = await fetch(
        `https://api.marketdata.app/v1/stocks/quotes/${symbol}?token=${this.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid or expired API key');
        }
        console.warn(`Failed to fetch quote for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.s !== 'ok') {
        console.warn(`Invalid response for ${symbol}: ${data.s}`);
        return null;
      }

      const price = parseFloat(data.last?.[0]);
      const change = parseFloat(data.ch?.[0] || 0);
      const changePercent = parseFloat(data.chp?.[0] || 0);
      const name = data.name?.[0] || symbol;

      if (isNaN(price)) {
        console.warn(`Invalid numeric data for ${symbol}`);
        return null;
      }

      return {
        name,
        price,
        change,
        changePercent
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
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
            // Fetch from our server using configured API_URL
            const response = await fetch(
                `${config.API_URL}symbols/search?q=${encodeURIComponent(query)}`,
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

            if (!data || !Array.isArray(data.results)) {
                console.warn('Invalid response format from symbols search');
                throw new Error('Invalid response format');
            }

            // Cache the results
            this.searchCache.set(cacheKey, {
                timestamp: Date.now(),
                results: data.results
            });

            return data.results;
        } catch (apiError) {
            console.warn('API search failed, using fallback data:', apiError);
        }
    } catch (error) {
        console.error('Error searching symbols:', error);
        return this.getMockSymbols(query); // Always return some data for testing
    }
  }

  // Fallback mock data for testing
  getMockSymbols(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const upperQuery = query.toUpperCase().trim();

    // Return all mock data if query is too short
    if (upperQuery.length < 2) {
      return [];
    }

    const mockData = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
      { symbol: 'V', name: 'Visa Inc.' },
      { symbol: 'JNJ', name: 'Johnson & Johnson' }
    ];

    return mockData
      .filter(item =>
        item.symbol.includes(upperQuery) ||
        item.name.toUpperCase().includes(upperQuery)
      )
      .slice(0, 6);
  }
}

export const marketDataProvider = new MarketDataAppProvider();