import { MarketDataNewsProviderInterface } from './MarketDataNewsProvider.interface.js';

export class MarketDataNewsProvider extends MarketDataNewsProviderInterface {
  constructor() {
    super();
    this.apiKey = 'VG1hV1pNclRSeUYtZ2N1S2kyeXhvanBKbloyUTVtVGl6a2VjemNpazFyYz0';
  }

  async getStockNews(symbol) {
    try {
      const response = await fetch(
        `https://api.marketdata.app/v1/stocks/news/${symbol}/?token=${this.apiKey}&limit=2`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch news for ${symbol}`);
      }

      const data = await response.json();
      
      if (data.s !== 'ok') {
        throw new Error(`Invalid response for ${symbol}`);
      }

      // The API returns news items directly in the response
      return {
        symbol,
        news: [{
          headline: data.headline,
          source: data.source,
          updated: data.updated
        }]
      };
    } catch (error) {
      console.error('marketdata.app news error:', error);
      throw error;
    }
  }
} 