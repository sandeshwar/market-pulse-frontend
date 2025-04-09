import React, { useState, useEffect } from 'react';
import { SymbolSearch } from '../../common/SymbolSearch/SymbolSearch.jsx';
import { watchlistService } from '../../../services/watchlistService.js';
import { ICONS } from '../../../utils/icons.js';
import { ensureDefaultWatchlist, DEFAULT_WATCHLIST_NAME } from '../../../utils/watchlistUtils.js';
import { createCard } from '../../common/Card/Card.js';
import { createRoot } from 'react-dom/client';
import { replaceIcons } from '../../../utils/feather.js';

export function WatchlistSettingsReact() {
  const [watchlist, setWatchlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderKey, setRenderKey] = useState(0); // Add a key to force re-render

  // Load watchlist data on component mount
  const loadWatchlistData = async () => {
    try {
      setLoading(true);
      const watchlist = await ensureDefaultWatchlist();
      setWatchlist(watchlist);
      setError(null);
      
      // Increment render key to force a complete re-render
      setRenderKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load watchlist data:', error);
      setError('Failed to load watchlist data');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    loadWatchlistData();

    // Add watchlist service listener for updates
    watchlistService.addListener(loadWatchlistData);

    // Cleanup listener on component unmount
    return () => watchlistService.removeListener(loadWatchlistData);
  }, []);

  // Effect to replace icons after each render
  useEffect(() => {
    // Replace icons after the component has rendered
    setTimeout(() => {
      replaceIcons();
    }, 0);
  }, [renderKey, watchlist]); // Re-run when watchlist or renderKey changes

  const handleSymbolSelect = (symbol) => {
    // If watchlist is not available, ensure the default watchlist exists first
    if (!watchlist) {
      ensureDefaultWatchlist()
        .then(newWatchlist => {
          // Create optimistic update
          const symbolStr = symbol.symbol || symbol;
          const optimisticWatchlist = {
            ...newWatchlist,
            symbols: [...(newWatchlist.symbols || []), symbolStr]
          };
          setWatchlist(optimisticWatchlist);

          return watchlistService.addSymbol(DEFAULT_WATCHLIST_NAME, symbol);
        })
        .then(() => {
          // No need to refresh data here as the service will notify listeners
          console.log('Symbol added successfully');
        })
        .catch((error) => {
          console.error('Failed to add symbol:', error);
          alert('Failed to add symbol: ' + error.message);
          // Revert to the actual data on error
          loadWatchlistData();
        });
      return;
    }

    // Use the watchlist name from watchlist, or fall back to DEFAULT_WATCHLIST_NAME
    const watchlistName = watchlist.name || DEFAULT_WATCHLIST_NAME;

    // Create optimistic update for better responsiveness
    const symbolStr = symbol.symbol || symbol;
    const optimisticWatchlist = {
      ...watchlist,
      symbols: [...watchlist.symbols, symbolStr]
    };
    setWatchlist(optimisticWatchlist);

    // Pass the full symbol object to store additional data
    watchlistService.addSymbol(watchlistName, symbol)
      .then(() => {
        // No need to refresh data here as the service will notify listeners
        console.log('Symbol added successfully');
      })
      .catch((error) => {
        console.error('Failed to add symbol:', error);
        alert('Failed to add symbol: ' + error.message);
        // Revert to the actual data on error
        loadWatchlistData();
      });
  };

  const handleRemoveSymbol = (symbol) => {
    if (!watchlist) return;

    const watchlistName = watchlist.name || DEFAULT_WATCHLIST_NAME;

    // Optimistically update the UI first for better responsiveness
    const optimisticWatchlist = {
      ...watchlist,
      symbols: watchlist.symbols.filter(sym => sym !== symbol)
    };
    setWatchlist(optimisticWatchlist);

    // Then perform the actual update
    watchlistService.removeSymbol(watchlistName, symbol)
      .then(() => {
        // No need to refresh data here as the service will notify listeners
        console.log('Symbol removed successfully');
      })
      .catch((error) => {
        console.error('Failed to remove symbol:', error);
        alert('Failed to remove symbol: ' + error.message);
        // Revert to the actual data on error
        loadWatchlistData();
      });
  };

  // Render symbols list
  const renderSymbolsList = () => {
    if (!watchlist || !watchlist.symbols || watchlist.symbols.length === 0) {
      return (
        <div className="empty-state">
          <i data-feather={ICONS.alertCircle}></i>
          <p>No stocks in your watchlist</p>
          <p className="empty-state__hint">Use the search above to add stocks</p>
        </div>
      );
    }

    return (
      <div className="watchlist-symbols">
        <div className="symbols-grid">
          {watchlist.symbols.map(symbol => (
            <div className="symbol-card" key={`${symbol}-${renderKey}`}>
              <div className="symbol-card__content">
                <div className="symbol-card__header">
                  <span className="symbol-ticker">{symbol}</span>
                  <button 
                    className="btn btn--icon btn--delete"
                    onClick={() => handleRemoveSymbol(symbol)}
                    title={`Remove ${symbol}`}
                  >
                    <i data-feather={ICONS.trash}></i>
                  </button>
                </div>
                <div className="symbol-card__details">
                  <span className="symbol-label">Symbol</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading your watchlist...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="error-state">
        <i data-feather={ICONS.alertTriangle}></i>
        <h3>Unable to load watchlist</h3>
        <p>{error}</p>
        <button 
          className="btn btn--primary btn--retry" 
          onClick={loadWatchlistData}
        >
          <i data-feather={ICONS.refreshCw}></i> Retry
        </button>
      </div>
    );
  }

  // Render main content
  return (
    <div className="watchlist-content">
      <div className="watchlist-search-section">
        <SymbolSearch
          onSelect={handleSymbolSelect}
          maxResults={6}
          placeholder="Search and add symbol (e.g. AAPL)"
          autoFocus={false}
        />
      </div>
      {renderSymbolsList()}
    </div>
  );
}

export async function createWatchlistSettingsReact() {
  // Create a wrapper element
  const settingsPage = document.createElement('div');
  settingsPage.className = 'watchlist-settings';

  // Add card with initial loading state
  settingsPage.innerHTML = createCard({
    title: 'Watchlist',
    icon: ICONS.star,
    content: '<div id="watchlist-settings-react-root"></div>'
  });

  // Add custom class to the card
  const cardElement = settingsPage.querySelector('.card');
  if (cardElement) {
    cardElement.classList.add('card--watchlist');
  }

  // Initialize React component after rendering
  setTimeout(() => {
    const container = settingsPage.querySelector('#watchlist-settings-react-root');
    if (container) {
      const root = createRoot(container);
      root.render(<WatchlistSettingsReact />);
    }
    
    // Replace icons
    replaceIcons();
  }, 0);

  return settingsPage;
}