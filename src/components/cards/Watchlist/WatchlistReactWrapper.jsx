import React from 'react';
import { createRoot } from 'react-dom/client';
import { WatchlistCard } from './Watchlist.jsx';

/**
 * Creates a DOM element with a React WatchlistCard component rendered inside it
 * This wrapper allows us to use the React component in a vanilla JS environment
 * while maintaining the same API as the original createWatchlistCard function
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.title - The title of the watchlist card
 * @returns {HTMLElement} - A DOM element containing the React component
 */
export async function createWatchlistCardReact({ title = 'Watchlist' } = {}) {
  // Create a container element
  const containerElement = document.createElement('div');
  containerElement.className = 'watchlist-card-container';
  
  // Create a root for React to render into
  const root = createRoot(containerElement);
  
  // Render the React component
  root.render(<WatchlistCard title={title} />);
  
  // Track mounted state
  let isMounted = true;
  
  // Add cleanup method to match the API of the original createWatchlistCard
  containerElement.cleanup = () => {
    if (isMounted) {
      isMounted = false;
      // Unmount the React component
      root.unmount();
      console.log('WatchlistCard React component unmounted');
    }
  };
  
  return containerElement;
}