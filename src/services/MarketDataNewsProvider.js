import { MarketDataNewsProviderInterface } from './MarketDataNewsProvider.interface.js';
import { config } from '../config.js';

export class MarketDataNewsProvider extends MarketDataNewsProviderInterface {
  constructor() {
    super();
    this.apiKey = config.API_KEY;
  }

  async getStockNews(symbol) {
    // Using Tiingo provider for news
    // For now, return mock data until we implement the news endpoint in our API
    return {
      symbol,
      news: [
        {
          headline: `Latest news for ${symbol}`,
          source: 'Tiingo News',
          updated: Date.now()
        },
        {
          headline: 'Market update',
          source: 'Tiingo Market News',
          updated: Date.now() - 3600000 // 1 hour ago
        }
      ]
    };

    // TODO: Implement actual news fetching from Tiingo API
    // try {
    //   const response = await fetch(
    //     `${config.API_URL}news?symbols=${symbol}&limit=5`,
    //     {
    //       method: 'GET',
    //       headers: {
    //         'Accept': 'application/json'
    //       }
    //     }
    //   );
    //
    //   if (!response.ok) {
    //     throw new Error(`Failed to fetch news for ${symbol}`);
    //   }
    //
    //   const data = await response.json();
    //
    //   return {
    //     symbol,
    //     news: data.news.map(item => ({
    //       headline: item.title,
    //       source: item.source,
    //       updated: new Date(item.publishedDate).getTime()
    //     }))
    //   };
    // } catch (error) {
    //   console.error('News API error:', error);
    //   throw error;
    // }
  }
}