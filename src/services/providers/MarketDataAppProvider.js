import { MarketDataProvider } from './MarketDataProvider';

export class MarketDataAppProvider extends MarketDataProvider {
  constructor() {
    super();
    this.apiKey = null;
    // Using major index ETFs
    this.symbols = {
      'DJI': 'Dow Jones'
    };
  }

  getName() {
    return 'MarketData.app';
  }

  isReady() {
    return !!this.apiKey;
  }

  getConfigRequirements() {
    return [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'string',
        required: true
      }
    ];
  }

  setConfig(config) {
    this.apiKey = config.apiKey;
  }

  async getMarketIndices() {
    if (!this.isReady()) {
      throw new Error('Provider not configured');
    }

    try {
      // Use the correct endpoint for indices
      const symbols = Object.keys(this.symbols).join(',');
      const response = await fetch(
        `https://api.marketdata.app/v1/indices/quotes/VIX`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch market data: ${errorText}`);
      }

      const data = await response.json();

      let quotes = [];
      if (Array.isArray(data)) {
        quotes = Object.keys(this.symbols).map(symbol => {
          const symbolData = data.find(item => item.symbol === symbol);
          if (!symbolData) {
            console.warn(`No data available for ${symbol}`);
            return null;
          }
          const price = parseFloat(symbolData.last);
          const change = parseFloat(symbolData.change);
          const changePercent = parseFloat(symbolData.changepct);
          if (isNaN(price) || isNaN(change) || isNaN(changePercent)) {
            console.warn(`Invalid numeric data for ${symbol}`);
            return null;
          }
          return {
            name: this.symbols[symbol],
            value: price,
            change: change,
            changePercent: changePercent
          };
        });
      } else {
        quotes = Object.keys(this.symbols).map(symbol => {
          if (!data[symbol]) {
            console.warn(`No data available for ${symbol}`);
            return null;
          }
          const symbolData = data[symbol];
          const price = parseFloat(symbolData.last);
          const change = parseFloat(symbolData.change);
          const changePercent = parseFloat(symbolData.changepct);
          if (isNaN(price) || isNaN(change) || isNaN(changePercent)) {
            console.warn(`Invalid numeric data for ${symbol}`);
            return null;
          }
          return {
            name: this.symbols[symbol],
            value: price,
            change: change,
            changePercent: changePercent
          };
        });
      }

      const validQuotes = quotes.filter(quote => quote !== null);
      if (validQuotes.length === 0) {
        throw new Error('Unable to fetch any market data');
      }

      return validQuotes;
    } catch (error) {
      console.error('MarketData.app error:', error);
      throw error;
    }
  }
}
