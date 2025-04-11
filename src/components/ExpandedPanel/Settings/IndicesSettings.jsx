import { useState, useEffect, useRef } from 'react';
import { IndicesSearch } from '../../common/IndicesSearch/IndicesSearch.jsx';
import { indicesWatchlistService } from '../../../services/indicesWatchlistService.js';
import { ICONS } from '../../../utils/icons.js';
import { ensureDefaultIndicesWatchlist, DEFAULT_INDICES_WATCHLIST_NAME, DEFAULT_INDICES } from '../../../utils/indicesWatchlistUtils.js';
import { createCard } from '../../common/Card/Card.js';
import { createRoot } from 'react-dom/client';
import { FeatherIcon } from '../../common/FeatherIcon/FeatherIcon.jsx';
import Loader from '../../common/Loader/Loader.jsx';

export function IndicesSettings() {
  const [watchlist, setWatchlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderKey, setRenderKey] = useState(0); // Add a key to force re-render

  // Load watchlist data on component mount
  const loadWatchlistData = async () => {
    try {
      setLoading(true);
      const watchlist = await ensureDefaultIndicesWatchlist();
      setWatchlist(watchlist);
      setError(null);
      
      // Increment render key to force a complete re-render
      setRenderKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load indices watchlist data:', error);
      setError('Failed to load indices watchlist data');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    loadWatchlistData();

    // Add watchlist service listener for updates
    indicesWatchlistService.addListener(loadWatchlistData);

    // Cleanup listener on component unmount
    return () => indicesWatchlistService.removeListener(loadWatchlistData);
  }, []);

  // Effect to replace icons after each render
  // No need to replace Feather icons anymore since we're using the FeatherIcon component

  const handleIndexSelect = (index) => {
    // If watchlist is not available, ensure the default watchlist exists first
    if (!watchlist) {
      ensureDefaultIndicesWatchlist()
        .then(newWatchlist => {
          // Create optimistic update
          const optimisticWatchlist = {
            ...newWatchlist,
            indices: [...(newWatchlist.indices || []), index.symbol || index]
          };
          setWatchlist(optimisticWatchlist);

          return indicesWatchlistService.addIndex(DEFAULT_INDICES_WATCHLIST_NAME, index);
        })
        .then(() => {
          // No need to refresh data here as the service will notify listeners
          console.log('Index added successfully');
        })
        .catch((error) => {
          console.error('Failed to add index:', error);
          alert('Failed to add index: ' + error.message);
          // Revert to the actual data on error
          loadWatchlistData();
        });
      return;
    }

    // Use the watchlist name from watchlist, or fall back to DEFAULT_INDICES_WATCHLIST_NAME
    const watchlistName = watchlist.name || DEFAULT_INDICES_WATCHLIST_NAME;

    // Create optimistic update for better responsiveness
    const indexSymbol = index.symbol || index;
    const optimisticWatchlist = {
      ...watchlist,
      indices: [...watchlist.indices, indexSymbol]
    };
    setWatchlist(optimisticWatchlist);

    // Pass the full index object to store additional data
    indicesWatchlistService.addIndex(watchlistName, index)
      .then(() => {
        // No need to refresh data here as the service will notify listeners
        console.log('Index added successfully');
      })
      .catch((error) => {
        console.error('Failed to add index:', error);
        alert('Failed to add index: ' + error.message);
        // Revert to the actual data on error
        loadWatchlistData();
      });
  };

  const handleRemoveIndex = (indexSymbol) => {
    if (!watchlist) return;

    // Check if this is one of our default indices
    const isDefaultIndex = DEFAULT_INDICES.includes(indexSymbol);
    
    // Show a confirmation dialog if trying to remove a default index
    if (isDefaultIndex) {
      const confirmRemove = window.confirm(
        `${indexSymbol} is one of the default market indices. Are you sure you want to remove it?`
      );
      
      if (!confirmRemove) {
        return; // User cancelled the removal
      }
    }

    const watchlistName = watchlist.name || DEFAULT_INDICES_WATCHLIST_NAME;

    // Optimistically update the UI first for better responsiveness
    const optimisticWatchlist = {
      ...watchlist,
      indices: watchlist.indices.filter(idx => idx !== indexSymbol)
    };
    setWatchlist(optimisticWatchlist);

    // Then perform the actual update
    indicesWatchlistService.removeIndex(watchlistName, indexSymbol)
      .then(() => {
        // No need to refresh data here as the service will notify listeners
        console.log('Index removed successfully');
      })
      .catch((error) => {
        console.error('Failed to remove index:', error);
        alert('Failed to remove index: ' + error.message);
        // Revert to the actual data on error
        loadWatchlistData();
      });
  };

  // Render indices list
  const renderIndicesList = () => {
    if (!watchlist || !watchlist.indices || watchlist.indices.length === 0) {
      return (
        <div className="empty-state">
          <FeatherIcon icon={ICONS.alertCircle} size={{ width: 24, height: 24 }} />
          <p>No indices in your watchlist</p>
          <p className="empty-state__hint">Use the search above to add indices</p>
        </div>
      );
    }

    return (
      <div className="watchlist-symbols">
        <div className="symbols-grid">
          {watchlist.indices.map(indexSymbol => (
            <div className="symbol-card" key={`${indexSymbol}-${renderKey}`}>
              <div className="symbol-card__content">
                <div className="symbol-card__header">
                  <span className="symbol-ticker">{indexSymbol}</span>
                  <button 
                    className="btn btn--icon btn--delete"
                    onClick={() => handleRemoveIndex(indexSymbol)}
                    title={`Remove ${indexSymbol}`}
                  >
                    <FeatherIcon icon={ICONS.trash} size={{ width: 16, height: 16 }} />
                  </button>
                </div>
                <div className="symbol-card__details">
                  <span className="symbol-label">Index</span>
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
    return <Loader size="medium" type="pulse" text="Loading your indices watchlist..." />;
  }

  // Render error state
  if (error) {
    return (
      <div className="error-state">
        <FeatherIcon icon={ICONS.alertTriangle} size={{ width: 24, height: 24 }} />
        <h3>Unable to load indices watchlist</h3>
        <p>{error}</p>
        <button 
          className="btn btn--primary btn--retry" 
          onClick={loadWatchlistData}
        >
          <FeatherIcon icon={ICONS.refreshCw} size={{ width: 16, height: 16 }} /> Retry
        </button>
      </div>
    );
  }

  // Render main content
  return (
    <div className="watchlist-content">
      <div className="watchlist-search-section">
        <IndicesSearch
          onSelect={handleIndexSelect}
          maxResults={6}
          placeholder="Search and add index (e.g. SPX, S&P 500)"
          autoFocus={false}
        />
      </div>
      {renderIndicesList()}
    </div>
  );
}

export async function createIndicesSettingsReact() {
  // Create a wrapper element
  const settingsPage = document.createElement('div');
  settingsPage.className = 'indices-watchlist-settings';

  // Add card with initial loading state
  settingsPage.innerHTML = createCard({
    title: 'Market Indices',
    icon: ICONS.trendingUp,
    content: '<div id="indices-settings-react-root"></div>'
  });

  // Add custom class to the card
  const cardElement = settingsPage.querySelector('.card');
  if (cardElement) {
    cardElement.classList.add('card--indices-watchlist');
  }

  // Initialize React component after rendering
  setTimeout(() => {
    const container = settingsPage.querySelector('#indices-settings-react-root');
    if (container) {
      const root = createRoot(container);
      root.render(<IndicesSettingsReact />);
    }
    
    // No need to replace icons anymore
  }, 0);

  return settingsPage;
}