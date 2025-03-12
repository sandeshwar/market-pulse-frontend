import { watchlistService } from '../services/watchlistService.js';

// Default watchlist name - we'll only use one watchlist
export const DEFAULT_WATCHLIST_NAME = 'My Watchlist';

/**
 * Helper function to ensure the default watchlist exists
 * @returns {Promise<Object>} The default watchlist object
 */
export async function ensureDefaultWatchlist() {
  try {
    const watchlists = await watchlistService.getWatchlists();
    
    // If no watchlists exist, create the default one
    if (watchlists.length === 0) {
      await watchlistService.createWatchlist(DEFAULT_WATCHLIST_NAME);
      return { name: DEFAULT_WATCHLIST_NAME, symbols: [] };
    }
    
    // Return the first watchlist (we'll only use one)
    return watchlists[0];
  } catch (error) {
    console.error('Error ensuring default watchlist:', error);
    throw error;
  }
}