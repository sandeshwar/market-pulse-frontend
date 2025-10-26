import { config } from '../../config.js';

export class MarketDataAppProvider {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const resolvedConfig = config?.API_KEY ? config : (config.default ?? {});
    this.apiKey = resolvedConfig.API_KEY?.trim() || null;

    if (!this.apiKey) {
      console.warn('MarketDataAppProvider: API key not configured, proceeding without authentication.');
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

      if (data?.error) {
        const errorMessage = data.error || 'Indices API returned an error';
        const detailedMessage = data.code ? `${errorMessage} (code: ${data.code})` : errorMessage;
        throw new Error(detailedMessage);
      }

      const prices = data?.prices;
      if (!prices || typeof prices !== 'object') {
        throw new Error('Indices API returned no price data');
      }

      const priceEntries = Object.entries(prices);
      if (priceEntries.length === 0) {
        throw new Error('No indices data available');
      }

      // Transform the response to match our expected format
      const validQuotes = priceEntries.map(([symbol, indexData]) => {
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
}

export const marketDataProvider = new MarketDataAppProvider();