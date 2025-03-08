/**
 * Interface for market data providers
 * This is just a reference for the expected methods and their signatures.
 * It's not meant to be instantiated or extended.
 */

/**
 * Get market indices data
 * @returns {Promise<Array<{name: string, value: number, change: number, changePercent: number}>>}
 */

/**
 * Get quote for a specific stock symbol
 * @param {string} symbol - The stock symbol to get quote for
 * @returns {Promise<{name: string, price: number, change: number, changePercent: number}>}
 */

/**
 * Search for stock symbols based on a query string
 * @param {string} query - The search query
 * @returns {Promise<Array<{symbol: string, name: string}>>}
 */

// This file is just documentation - no actual class is exported