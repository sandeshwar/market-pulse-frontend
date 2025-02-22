/**
 * Abstract base class for market data providers
 */
export class MarketDataProvider {
  constructor() {
    if (this.constructor === MarketDataProvider) {
      throw new Error("Abstract class 'MarketDataProvider' cannot be instantiated.");
    }
  }

  /**
   * Get market indices data
   * @returns {Promise<Array<{name: string, value: number, change: number, changePercent: number}>>}
   */
  async getMarketIndices() {
    throw new Error('Method not implemented');
  }

  /**
   * Get quote for a specific stock symbol
   * @param {string} symbol - The stock symbol to get quote for
   * @returns {Promise<{name: string, price: number, change: number, changePercent: number}>}
   */
  async getQuote(symbol) {
    throw new Error('Method not implemented');
  }
}