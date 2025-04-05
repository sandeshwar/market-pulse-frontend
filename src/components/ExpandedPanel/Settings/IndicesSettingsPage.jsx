import React from 'react';
import { createRoot } from 'react-dom/client';
import { IndicesSearch } from '../../common/IndicesSearch/IndicesSearch.jsx';
import { indicesWatchlistService } from '../../../services/indicesWatchlistService.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import { ensureDefaultIndicesWatchlist, DEFAULT_INDICES_WATCHLIST_NAME } from '../../../utils/indicesWatchlistUtils.js';

export async function createIndicesSettingsPage() {
  // Create a wrapper element
  const settingsPage = document.createElement('div');
  settingsPage.className = 'settings-page';

  // Create indices watchlist card
  const indicesWatchlistCard = document.createElement('div');
  indicesWatchlistCard.className = 'indices-watchlist-settings';

  // Add card with initial loading state
  indicesWatchlistCard.innerHTML = createCard({
    title: 'Market Indices',
    icon: ICONS.trendingUp,
    content: '<div class="loading"><div class="loading-spinner"></div><p>Loading your indices watchlist...</p></div>'
  });

  // Add custom class to the card
  const cardElement = indicesWatchlistCard.querySelector('.card');
  if (cardElement) {
    cardElement.classList.add('card--indices-watchlist');
  }

  settingsPage.appendChild(indicesWatchlistCard);

  // Initialize the content after rendering
  setTimeout(async () => {
    await initializeIndicesWatchlistSettings(indicesWatchlistCard);
  }, 0);

  return settingsPage;
}

async function initializeIndicesWatchlistSettings(containerElement) {
  const cardContent = containerElement.querySelector('.card__content');
  if (!cardContent) return;

  try {
    // Ensure the default indices watchlist exists
    let watchlist = await ensureDefaultIndicesWatchlist();

    // Get the indices
    const indicesList = watchlist.indices && watchlist.indices.length > 0
      ? `
        <div class="indices-watchlist-items">
          <div class="indices-grid">
            ${watchlist.indices.map(indexSymbol => `
              <div class="index-card">
                <div class="index-card__content">
                  <div class="index-card__header">
                    <span class="index-ticker">${indexSymbol}</span>
                    <button class="btn btn--icon btn--delete"
                      data-action="removeIndex"
                      data-index="${indexSymbol}"
                      title="Remove ${indexSymbol}">
                      <i data-feather="${ICONS.trash}"></i>
                    </button>
                  </div>
                  <div class="index-card__details">
                    <span class="index-label">Index</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : `<div class="empty-state"><i data-feather="${ICONS.alertCircle}"></i><p>No indices in your watchlist</p><p class="empty-state__hint">Use the search below to add indices</p></div>`;

    // Render the content
    cardContent.innerHTML = `
      <div class="indices-watchlist-content">
        <div class="indices-watchlist-search-section">
          <h3 class="watchlist-section-title">Add New Index</h3>
          <div class="indices-search-container"></div>
        </div>
        ${indicesList}
      </div>
    `;

    await replaceIcons();

    // Initialize the IndicesSearch component directly
    const searchContainer = cardContent.querySelector('.indices-search-container');
    if (searchContainer) {
      initializeIndicesSearch(searchContainer);
    }

    // Add event listeners for index removal
    const deleteButtons = cardContent.querySelectorAll('[data-action="removeIndex"]');
    deleteButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const indexSymbol = button.getAttribute('data-index');

        try {
          // Get the actual watchlist first
          const watchlist = await ensureDefaultIndicesWatchlist();
          await indicesWatchlistService.removeIndex(watchlist.name, indexSymbol);
          // Refresh the UI
          await initializeIndicesWatchlistSettings(containerElement);
        } catch (error) {
          console.error('Failed to remove index:', error);
          alert('Failed to remove index: ' + error.message);
        }
      });
    });

  } catch (error) {
    console.error('Error initializing indices watchlist settings:', error);
    cardContent.innerHTML = `
      <div class="error-state">
        <i data-feather="${ICONS.alertTriangle}"></i>
        <h3>Unable to load indices watchlist</h3>
        <p>${error.message || 'An unexpected error occurred'}</p>
        <button class="btn btn--primary btn--retry" onclick="location.reload()">
          <i data-feather="${ICONS.refreshCw}"></i> Retry
        </button>
      </div>
    `;
    await replaceIcons();
  }
}

function initializeIndicesSearch(containerElement) {
  // Create a React root for the indices search
  const root = createRoot(containerElement);

  // Render the IndicesSearch component directly
  root.render(
    <IndicesSearch
      onSelect={(index) => {
        // Get the actual watchlist first, then add the index
        ensureDefaultIndicesWatchlist()
          .then(watchlist => {
            return indicesWatchlistService.addIndex(watchlist.name, index);
          })
          .then(() => {
            // Find the container element to refresh
            const container = containerElement.closest('.indices-watchlist-settings');
            if (container) {
              initializeIndicesWatchlistSettings(container);
            }
          })
          .catch(error => {
            console.error('Failed to add index:', error);
            alert('Failed to add index: ' + error.message);
          });
      }}
      maxResults={6}
      placeholder="Search and add index (e.g. SPX, S&P 500)"
      autoFocus={true}
    />
  );
}