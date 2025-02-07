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
   * Get provider name
   * @returns {string}
   */
  getName() {
    throw new Error('Method not implemented');
  }

  /**
   * Check if provider is ready/configured
   * @returns {boolean}
   */
  isReady() {
    throw new Error('Method not implemented');
  }

  /**
   * Get provider configuration requirements
   * @returns {Array<{key: string, label: string, type: string, required: boolean}>}
   */
  getConfigRequirements() {
    throw new Error('Method not implemented');
  }

  /**
   * Set provider configuration
   * @param {Object} config
   */
  setConfig(config) {
    throw new Error('Method not implemented');
  }
} 