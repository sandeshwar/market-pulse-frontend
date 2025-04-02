/**
 * Market Indices Configuration
 * 
 * This file centralizes all market indices definitions used throughout the application.
 * It provides a single source of truth for index symbols, display names, and groupings.
 */

// Default indices to display in the Market Indices card
export const DEFAULT_DISPLAY_INDICES = [
  'SPX',
  'DJI',
  'IXIC',
  'NDX',
  'VIX'
];

// All supported market indices with their display names
export const MARKET_INDICES = {
  // US Indices
  'SPX': 'S&P 500',
  'DJI': 'Dow Jones',
  'IXIC': 'NASDAQ Composite',
  'NDX': 'NASDAQ 100',
  'RUT': 'Russell 2000',
  'VIX': 'CBOE Volatility Index',
  
  // European Indices
  'FTSE': 'FTSE 100',
  'DAX': 'DAX',
  'CAC': 'CAC 40',
  'STOXX50E': 'Euro Stoxx 50',
  
  // Asian Indices
  'N225': 'Nikkei 225',
  'HSI': 'Hang Seng',
  'SSEC': 'Shanghai Composite',
  'SENSEX': 'BSE SENSEX',
  'NIFTY': 'NIFTY 50'
};

// Indices grouped by region
export const INDICES_BY_REGION = {
  'US': ['SPX', 'DJI', 'IXIC', 'NDX', 'RUT', 'VIX'],
  'Europe': ['FTSE', 'DAX', 'CAC', 'STOXX50E'],
  'Asia': ['N225', 'HSI', 'SSEC', 'SENSEX', 'NIFTY']
};

/**
 * Gets the display name for a market index
 * @param {string} symbol - The index symbol
 * @returns {string} The display name or the symbol if not found
 */
export function getIndexDisplayName(symbol) {
  return MARKET_INDICES[symbol] || symbol;
}

/**
 * Gets all index symbols
 * @returns {string[]} Array of all index symbols
 */
export function getAllIndexSymbols() {
  return Object.keys(MARKET_INDICES);
}

/**
 * Gets indices for a specific region
 * @param {string} region - The region name ('US', 'Europe', 'Asia')
 * @returns {string[]} Array of index symbols for the region
 */
export function getIndicesByRegion(region) {
  return INDICES_BY_REGION[region] || [];
}

/**
 * Fetches market indices data from the API
 * @param {string[]} symbols - Optional array of index symbols to fetch
 * @returns {Promise<Object>} Promise resolving to market indices data
 */
export async function fetchMarketIndices(symbols = DEFAULT_DISPLAY_INDICES) {
  try {
    const symbolsParam = symbols.join(',');
    const response = await fetch(`/api/market-data/indices?symbols=${symbolsParam}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch market indices: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching market indices:', error);
    return { indices: {} };
  }
}

/**
 * Fetches the list of available market indices from the API
 * @returns {Promise<Object>} Promise resolving to available indices data
 */
export async function fetchAvailableIndices() {
  try {
    const response = await fetch('/api/indices/available');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch available indices: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching available indices:', error);
    return { symbols: [], display_names: {} };
  }
}

/**
 * Fetches the default display indices from the API
 * @returns {Promise<string[]>} Promise resolving to default display indices
 */
export async function fetchDefaultDisplayIndices() {
  try {
    const response = await fetch('/api/indices/default');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch default indices: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching default indices:', error);
    return DEFAULT_DISPLAY_INDICES;
  }
}