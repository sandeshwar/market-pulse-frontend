import React, { useState, useEffect } from 'react';
import { IndicesSearch } from '../../common/IndicesSearch/IndicesSearch.jsx';
import { indicesWatchlistService } from '../../../services/indicesWatchlistService.js';
import { ICONS } from '../../../utils/icons.js';
import { ensureDefaultIndicesWatchlist, DEFAULT_INDICES_WATCHLIST_NAME } from '../../../utils/indicesWatchlistUtils.js';
import { createCard } from '../../common/Card/Card.js';
import { createRoot } from 'react-dom/client';
import { replaceIcons } from '../../../utils/feather.js';

export function IndicesSettingsReact() {
  const [watchlist, setWatchlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load watchlist data on component mount
  const loadWatchlistData = async () => {
    try {
      setLoading(true);
      const watchlist = await ensureDefaultIndicesWatchlist();
      setWatchlist(watchlist);
      setError(null);
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

  const handleIndexSelect = (index) => {
    // If watchlist is not available, ensure the default watchlist exists first
    if (!watchlist) {
      ensureDefaultIndicesWatchlist()
        .then(watchlist => {
          return indicesWatchlistService.addIndex(DEFAULT_INDICES_WATCHLIST_NAME, index);
        })
        .then(() => {
          // Refresh watchlist data
          loadWatchlistData();
        })
        .catch((error) => {
          console.error('Failed to add index:', error);
          alert('Failed to add index: ' + error.message);
        });
      return;
    }

    // Use the watchlist name from watchlist, or fall back to DEFAULT_INDICES_WATCHLIST_NAME
    const watchlistName = watchlist.name || DEFAULT_INDICES_WATCHLIST_NAME;

    // Pass the full index object to store additional data
    indicesWatchlistService.addIndex(watchlistName, index)
      .then(() => {
        // Refresh watchlist data
        loadWatchlistData();
      })
      .catch((error) => {
        console.error('Failed to add index:', error);
        alert('Failed to add index: ' + error.message);
      });
  };

  const handleRemoveIndex = (indexSymbol) => {
    if (!watchlist) return;

    const watchlistName = watchlist.name || DEFAULT_INDICES_WATCHLIST_NAME;
    
    indicesWatchlistService.removeIndex(watchlistName, indexSymbol)
      .then(() => {
        // Refresh watchlist data
        loadWatchlistData();
      })
      .catch((error) => {
        console.error('Failed to remove index:', error);
        alert('Failed to remove index: ' + error.message);
      });
  };

  // Render indices list
  const renderIndicesList = () => {
    if (!watchlist || !watchlist.indices || watchlist.indices.length === 0) {
      return (
        <div className="empty-state">
          <i data-feather={ICONS.alertCircle}></i>
          <p>No indices in your watchlist</p>
          <p className="empty-state__hint">Use the search below to add indices</p>
        </div>
      );
    }

    return (
      <div className="watchlist-symbols">
        <div className="symbols-grid">
          {watchlist.indices.map(indexSymbol => (
            <div className="symbol-card" key={indexSymbol}>
              <div className="symbol-card__content">
                <div className="symbol-card__header">
                  <span className="symbol-ticker">{indexSymbol}</span>
                  <button 
                    className="btn btn--icon btn--delete"
                    onClick={() => handleRemoveIndex(indexSymbol)}
                    title={`Remove ${indexSymbol}`}
                  >
                    <i data-feather={ICONS.trash}></i>
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
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading your indices watchlist...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="error-state">
        <i data-feather={ICONS.alertTriangle}></i>
        <h3>Unable to load indices watchlist</h3>
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
        <h3 className="watchlist-section-title">Add New Index</h3>
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
    
    // Replace icons
    replaceIcons();
  }, 0);

  return settingsPage;
}