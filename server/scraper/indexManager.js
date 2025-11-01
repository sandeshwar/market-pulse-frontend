export class IndexManager {
  constructor() {
    this.indices = new Map(); // Map<symbol, indexData>
    this.lastUpdated = null;
    this.lastSuccessfulScrape = null;
    this.scrapeStatus = 'initializing'; // 'initializing' | 'success' | 'stale' | 'error'
    this.totalScrapes = 0;
    this.failedScrapes = 0;
  }

  /**
   * Update indices data from scraper
   * @param {Array} indicesData - Array of index objects from scraper
   */
  updateIndices(indicesData) {
    if (!Array.isArray(indicesData)) {
      throw new Error('Indices data must be an array');
    }

    const now = Date.now();
    this.indices.clear();

    indicesData.forEach(index => {
      if (index.symbol && typeof index.price === 'number') {
        this.indices.set(index.symbol, {
          price: index.price,
          change: index.change || 0,
          percent_change: index.percent_change || 0,
          additional_data: {
            name: index.name || index.symbol,
            exchange: index.exchange || 'Unknown',
            lastUpdated: now
          }
        });
      }
    });

    this.lastUpdated = now;
    this.lastSuccessfulScrape = now;
    this.scrapeStatus = 'success';
    this.totalScrapes++;
    
    console.log(`✅ Updated ${this.indices.size} indices in memory`);
  }

  /**
   * Get all indices data in the format expected by frontend
   * @returns {Object} - {prices: {symbol: data}}
   */
  getAllIndices() {
    return {
      prices: Object.fromEntries(this.indices),
      metadata: {
        lastUpdated: this.lastUpdated,
        lastSuccessfulScrape: this.lastSuccessfulScrape,
        status: this.scrapeStatus,
        count: this.indices.size
      }
    };
  }

  /**
   * Search indices by symbol or name
   * @param {string} query - Search query
   * @returns {Array} - Array of matching indices
   */
  searchIndices(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const results = [];

    for (const [symbol, data] of this.indices) {
      const name = data.additional_data?.name || '';
      const exchange = data.additional_data?.exchange || '';
      
      if (symbol.toLowerCase().includes(searchTerm) ||
          name.toLowerCase().includes(searchTerm) ||
          exchange.toLowerCase().includes(searchTerm)) {
        results.push({
          symbol,
          name,
          exchange,
          price: data.price,
          change: data.change,
          percent_change: data.percent_change
        });
      }
    }

    return results.slice(0, 20); // Limit to 20 results
  }

  /**
   * Get specific index data by symbol
   * @param {string} symbol - Index symbol
   * @returns {Object|null} - Index data or null if not found
   */
  getIndex(symbol) {
    return this.indices.get(symbol) || null;
  }

  /**
   * Mark scrape as failed
   * @param {Error} error - The error that occurred
   */
  markScrapeFailed(error) {
    this.scrapeStatus = this.lastSuccessfulScrape ? 'stale' : 'error';
    this.failedScrapes++;
    console.error(`❌ Scrape failed: ${error.message}`);
  }

  /**
   * Get current status of the index manager
   * @returns {Object} - Status information
   */
  getStatus() {
    const now = Date.now();
    const timeSinceLastUpdate = this.lastUpdated ? now - this.lastUpdated : null;
    const timeSinceLastSuccess = this.lastSuccessfulScrape ? now - this.lastSuccessfulScrape : null;

    return {
      status: this.scrapeStatus,
      indicesCount: this.indices.size,
      lastUpdated: this.lastUpdated,
      lastSuccessfulScrape: this.lastSuccessfulScrape,
      timeSinceLastUpdate,
      timeSinceLastSuccess,
      totalScrapes: this.totalScrapes,
      failedScrapes: this.failedScrapes,
      successRate: this.totalScrapes > 0 ? 
        ((this.totalScrapes - this.failedScrapes) / this.totalScrapes * 100).toFixed(2) + '%' : 
        'N/A'
    };
  }

  /**
   * Check if data is stale (older than 5 minutes)
   * @returns {boolean}
   */
  isDataStale() {
    if (!this.lastSuccessfulScrape) return true;
    return Date.now() - this.lastSuccessfulScrape > 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Clear all indices data
   */
  clear() {
    this.indices.clear();
    this.lastUpdated = null;
    this.lastSuccessfulScrape = null;
    this.scrapeStatus = 'initializing';
    console.log('🧹 Cleared all indices data');
  }
}
