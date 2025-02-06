import { default as marketBackend } from '@sandeshwar/market-pulse-backend';
import { DEFAULT_REFRESH_INTERVAL, LOADING_STATES } from '../constants/marketConstants.js';

/**
 * Fetches the list of available market indices
 * @returns {Promise<Array<Object>>} List of market indices
 */
export async function fetchAvailableIndices() {
  try {
    return await marketBackend.getMarketIndices();
  } catch (error) {
    console.error('Error fetching available market indices:', error);
    throw new Error('Failed to fetch available market indices');
  }
}

/**
 * Transforms raw market data into a standardized format
 * @param {Object} quoteData - Raw quote data from the API
 * @param {string} displayName - User-friendly name for the index
 * @returns {Object} Formatted market data
 */
export function transformMarketData(quoteData, displayName) {
  return {
    name: displayName,
    value: quoteData.regularMarketPrice,
    change: quoteData.regularMarketChange,
    changePercent: quoteData.regularMarketChangePercent,
    timestamp: quoteData.regularMarketTime,
    status: quoteData.marketState?.toLowerCase() || LOADING_STATES.LOADING
  };
}

/**
 * Fetches market data for multiple indices
 * @param {Array<Object>} indices - Array of index configurations
 * @returns {Promise<Array<Object>>} Array of formatted market data
 */
export async function fetchIndicesData(indices) {
  try {
    const promises = indices.map(index => 
      marketBackend.getQuote(index.symbol)
        .then(data => transformMarketData(data, index.displayName))
        .catch(error => {
          console.error(`Error fetching data for ${index.displayName}:`, error);
          return null;
        })
    );

    const results = await Promise.all(promises);
    return results.filter(result => result !== null);
  } catch (error) {
    console.error('Error fetching market indices:', error);
    throw new Error('Failed to fetch market indices data');
  }
}

/**
 * Determines if market data needs refresh
 * @param {number} lastUpdateTime - Timestamp of last update
 * @returns {boolean} True if refresh is needed
 */
export function shouldRefreshData(lastUpdateTime) {
  if (!lastUpdateTime) return true;
  return Date.now() - lastUpdateTime >= DEFAULT_REFRESH_INTERVAL;
}