import { indicesWatchlistService } from '../services/indicesWatchlistService.js';

// Default indices watchlist name - we'll only use one watchlist
export const DEFAULT_INDICES_WATCHLIST_NAME = 'My Indices Watchlist';

// Default indices to include for all users
export const DEFAULT_INDICES = [
  'DJI',    // Dow Jones Industrial Average (NYSE)
  'IXIC',   // NASDAQ Composite
  'SENSEX',   // SENSEX (India)
  '399001',   // SZSE Component Index (China)
  'UKX'    // FTSE 100 (UK)
];

/**
 * Helper function to ensure the default indices watchlist exists
 * @returns {Promise<Object>} The default indices watchlist object
 */
export async function ensureDefaultIndicesWatchlist() {
  try {
    const watchlists = await indicesWatchlistService.getWatchlists();
    
    // If no watchlists exist, create the default one with predefined indices
    if (watchlists.length === 0) {
      const newWatchlist = await indicesWatchlistService.createWatchlist(DEFAULT_INDICES_WATCHLIST_NAME);
      
      // Add default indices to the new watchlist
      for (const indexSymbol of DEFAULT_INDICES) {
        try {
          await indicesWatchlistService.addIndex(DEFAULT_INDICES_WATCHLIST_NAME, indexSymbol);
        } catch (error) {
          console.warn(`Failed to add default index ${indexSymbol}:`, error);
          // Continue with other indices even if one fails
        }
      }
      
      // Get the updated watchlist with the default indices
      const updatedWatchlists = await indicesWatchlistService.getWatchlists();
      return updatedWatchlists[0];
    }
    
    // If the watchlist exists but has no indices, add the default ones
    if (watchlists[0] && (!watchlists[0].indices || watchlists[0].indices.length === 0)) {
      for (const indexSymbol of DEFAULT_INDICES) {
        try {
          await indicesWatchlistService.addIndex(watchlists[0].name, indexSymbol);
        } catch (error) {
          console.warn(`Failed to add default index ${indexSymbol}:`, error);
          // Continue with other indices even if one fails
        }
      }
      
      // Get the updated watchlist with the default indices
      const updatedWatchlists = await indicesWatchlistService.getWatchlists();
      return updatedWatchlists[0];
    }
    
    // Return the first watchlist (we'll only use one)
    return watchlists[0];
  } catch (error) {
    console.error('Error ensuring default indices watchlist:', error);
    throw error;
  }
}