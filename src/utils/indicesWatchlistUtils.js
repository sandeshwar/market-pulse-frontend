import { indicesWatchlistService } from '../services/indicesWatchlistService.js';

// Default indices watchlist name - we'll only use one watchlist
export const DEFAULT_INDICES_WATCHLIST_NAME = 'My Indices Watchlist';

/**
 * Helper function to ensure the default indices watchlist exists
 * @returns {Promise<Object>} The default indices watchlist object
 */
export async function ensureDefaultIndicesWatchlist() {
  try {
    const watchlists = await indicesWatchlistService.getWatchlists();
    
    // If no watchlists exist, create the default one
    if (watchlists.length === 0) {
      await indicesWatchlistService.createWatchlist(DEFAULT_INDICES_WATCHLIST_NAME);
      return { name: DEFAULT_INDICES_WATCHLIST_NAME, indices: [] };
    }
    
    // Return the first watchlist (we'll only use one)
    return watchlists[0];
  } catch (error) {
    console.error('Error ensuring default indices watchlist:', error);
    throw error;
  }
}