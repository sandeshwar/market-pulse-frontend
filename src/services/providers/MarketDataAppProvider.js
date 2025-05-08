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

      // Use the new Rust API endpoint for indices
      const response = await fetch(
        `${config.API_URL}indices/all`,
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

      // Log the entire response for debugging
      console.log('Indices API Response data:', data);

      if (!data || !data.prices) {
        throw new Error('Invalid response format from indices API');
      }

      // Transform the response to match our expected format
      const validQuotes = Object.entries(data.prices).map(([symbol, indexData]) => {
        // Extract the name from additional_data or use the symbol as fallback
        const name = indexData.additional_data?.name || symbol;

        return {
          name: symbol, // Use the symbol as the name field (for backward compatibility)
          value: indexData.price,
          change: indexData.change,
          changePercent: indexData.percent_change,
          // Include additional data that might be useful
          additionalData: indexData.additional_data
        };
      });

      if (validQuotes.length === 0) {
        throw new Error('No valid market indices data received');
      }

      return validQuotes;
    } catch (error) {
      console.error('Market indices API error:', error);
      throw error;
    }
  }

  async getMultipleStocks(symbols, options = {}) {
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      console.warn('Invalid symbols parameter:', symbols);
      return {};
    }

    try {
      await this.initialize();

      // Separate Indian (NSE) stocks from other stocks
      const indianStocks = [];
      const otherStocks = [];
      
      symbols.forEach(symbol => {
        // Check if the symbol is marked as an Indian stock (NSE)
        // This information would come from the watchlist data
        if (options.symbolsData) {
          const symbolData = options.symbolsData.find(data => data.symbol === symbol);
          if (symbolData && symbolData.market === 'NSE') {
            indianStocks.push(symbol);
            return;
          }
        }
        
        // Default to other stocks
        otherStocks.push(symbol);
      });

      // Process Indian stocks and other stocks separately
      const results = {};
      
      // Process other stocks using the regular API
      if (otherStocks.length > 0) {
        // Join all symbols with commas for the API request
        const symbolsParam = otherStocks.join(',');

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
        
        // Process the response and add to results
        if (response.ok) {
          const data = await response.json();
          if (data && data.prices) {
            Object.assign(results, this._processStockData(otherStocks, data));
          }
        }
      }
      
      // Process Indian stocks using the Indian stocks API
      if (indianStocks.length > 0) {
        // Join all symbols with commas for the API request
        const symbolsParam = indianStocks.join(',');

        // Use our dedicated Indian stocks API endpoint
        const response = await fetch(
          `${config.API_URL}indian-stocks?symbols=${symbolsParam}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          }
        );
        
        // Process the response and add to results
        if (response.ok) {
          const data = await response.json();
          if (data && data.prices) {
            Object.assign(results, this._processStockData(indianStocks, data));
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Error fetching quotes for [${symbols.join(',')}]:`, error);
      throw error;
    }
  }
  
  // Helper method to process stock data
  _processStockData(symbols, data) {
    const result = {};
    
    // Log the entire response for debugging
    console.log('API Response data:', data);
    
    // Iterate through the requested symbols to maintain order and handle missing data
    for (const symbol of symbols) {
      // Try to find the symbol data by exact match first
      let symbolData = data.prices[symbol];
      
      // If not found, try to find by checking if any returned symbol contains this symbol
      // This handles cases where the API returns "AAPL.US" but the request was for "AAPL"
      if (!symbolData) {
        const matchingSymbolKey = Object.keys(data.prices).find(key =>
          key.includes(symbol) || symbol.includes(key.split('.')[0])
        );
        
        if (matchingSymbolKey) {
          console.log(`Found matching symbol in API response: ${matchingSymbolKey} for requested symbol: ${symbol}`);
          symbolData = data.prices[matchingSymbolKey];
        }
      }
      
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
      
      // Log the data we're processing to help debug
      console.log(`Processing symbol data for ${symbol}:`, symbolData);
      
      result[symbol] = {
        name,
        price,
        change,
        changePercent: changePercent // Make sure we're using the correct property name
      };
    }
    
    return result;
  }

  // This is the original implementation, kept for reference
  // The new implementation is in getMultipleStocks
  async getMultipleStocksOriginal(symbols) {
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

      // Log the entire response for debugging
      console.log('API Response data:', data);

      // Iterate through the requested symbols to maintain order and handle missing data
      for (const symbol of symbols) {
        // Try to find the symbol data by exact match first
        let symbolData = data.prices[symbol];

        // If not found, try to find by checking if any returned symbol contains this symbol
        // This handles cases where the API returns "AAPL.US" but the request was for "AAPL"
        if (!symbolData) {
          const matchingSymbolKey = Object.keys(data.prices).find(key =>
            key.includes(symbol) || symbol.includes(key.split('.')[0])
          );

          if (matchingSymbolKey) {
            console.log(`Found matching symbol in API response: ${matchingSymbolKey} for requested symbol: ${symbol}`);
            symbolData = data.prices[matchingSymbolKey];
          }
        }

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

        // Log the data we're processing to help debug
        console.log(`Processing symbol data for ${symbol}:`, symbolData);

        result[symbol] = {
          name,
          price,
          change,
          changePercent: changePercent // Make sure we're using the correct property name
        };
      }

      return result;
    } catch (error) {
      console.error(`Error fetching quotes for [${symbols.join(',')}]:`, error);
      throw error;
    }
  }

  async searchSymbols(query, limit = 20) {
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
          `${baseUrl}symbols/search?q=${encodeURIComponent(query)}&limit=${limit}`,
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
        let results = Array.isArray(data) ? data : (data.results || []);
        
        // Transform the results if needed to ensure consistent format
        if (results.length > 0 && results[0].symbol) {
          // This is the format from /api/symbols/search endpoint
          results = results.map(item => ({
            ticker: item.symbol,
            exchange: item.exchange,
            assetType: item.asset_type,
            name: item.name
          }));
        }

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