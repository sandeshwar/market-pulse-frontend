import React from 'react';
import { createRoot } from 'react-dom/client';
import { SymbolSearch } from '../../common/SymbolSearch/SymbolSearch.jsx';
import { watchlistService } from '../../../services/watchlistService.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import { ensureDefaultWatchlist, DEFAULT_WATCHLIST_NAME } from '../../../utils/watchlistUtils.js';
import { createIndicesSettingsReact } from './IndicesSettingsReact.jsx';

export async function createSettingsPage() {
  // Create a wrapper element
  const settingsPage = document.createElement('div');
  settingsPage.className = 'settings-page';

  // Add the indices settings page (React version) first to match home page order
  const indicesSettingsPage = await createIndicesSettingsReact();
  settingsPage.appendChild(indicesSettingsPage);

  // Create watchlist card
  const watchlistCard = document.createElement('div');
  watchlistCard.className = 'watchlist-settings';

  // Add card with initial loading state
  watchlistCard.innerHTML = createCard({
    title: 'Watchlist',
    icon: ICONS.star,
    content: '<div class="loading"><div class="loading-spinner"></div><p>Loading your watchlist...</p></div>'
  });

  // Add custom class to the card
  const cardElement = watchlistCard.querySelector('.card');
  if (cardElement) {
    cardElement.classList.add('card--watchlist');
  }

  settingsPage.appendChild(watchlistCard);

  // Initialize the content after rendering
  setTimeout(async () => {
    await initializeWatchlistSettings(watchlistCard);
  }, 0);

  return settingsPage;
}

async function initializeWatchlistSettings(containerElement) {
  const cardContent = containerElement.querySelector('.card__content');
  if (!cardContent) return;

  try {
    // Ensure the default watchlist exists
    let watchlist = await ensureDefaultWatchlist();

    // Get the symbols
    const symbolsList = watchlist.symbols && watchlist.symbols.length > 0
      ? `
        <div class="watchlist-symbols">
          <div class="symbols-grid">
            ${watchlist.symbols.map(symbol => `
              <div class="symbol-card">
                <div class="symbol-card__content">
                  <div class="symbol-card__header">
                    <span class="symbol-ticker">${symbol}</span>
                    <button class="btn btn--icon btn--delete"
                      data-action="removeSymbol"
                      data-symbol="${symbol}"
                      title="Remove ${symbol}">
                      <i data-feather="${ICONS.trash}"></i>
                    </button>
                  </div>
                  <div class="symbol-card__details">
                    <span class="symbol-label">Symbol</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : `<div class="empty-state"><i data-feather="${ICONS.alertCircle}"></i><p>No symbols in your watchlist</p><p class="empty-state__hint">Use the search below to add symbols</p></div>`;

    // Render the content
    cardContent.innerHTML = `
      <div class="watchlist-content">
        <div class="watchlist-search-section">
          <div class="symbol-search-container"></div>
        </div>
        ${symbolsList}
      </div>
    `;

    await replaceIcons();

    // Initialize the SymbolSearch component directly
    const searchContainer = cardContent.querySelector('.symbol-search-container');
    if (searchContainer) {
      initializeSymbolSearch(searchContainer);
    }

    // Add event listeners for symbol removal
    const deleteButtons = cardContent.querySelectorAll('[data-action="removeSymbol"]');
    deleteButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const symbol = button.getAttribute('data-symbol');

        try {
          // Get the actual watchlist first
          const watchlist = await ensureDefaultWatchlist();
          await watchlistService.removeSymbol(watchlist.name, symbol);
          // Refresh the UI
          await initializeWatchlistSettings(containerElement);
        } catch (error) {
          console.error('Failed to remove symbol:', error);
          alert('Failed to remove symbol: ' + error.message);
        }
      });
    });

  } catch (error) {
    console.error('Error initializing watchlist settings:', error);
    cardContent.innerHTML = `
      <div class="error-state">
        <i data-feather="${ICONS.alertTriangle}"></i>
        <h3>Unable to load watchlist</h3>
        <p>${error.message || 'An unexpected error occurred'}</p>
        <button class="btn btn--primary btn--retry" onclick="location.reload()">
          <i data-feather="${ICONS.refreshCw}"></i> Retry
        </button>
      </div>
    `;
    await replaceIcons();
  }
}

function initializeSymbolSearch(containerElement) {
  // Create a React root for the symbol search
  const root = createRoot(containerElement);

  // Render the SymbolSearch component directly
  root.render(
    <SymbolSearch
      onSelect={(symbol) => {
        // Get the actual watchlist first, then add the symbol
        ensureDefaultWatchlist()
          .then(watchlist => {
            return watchlistService.addSymbol(watchlist.name, symbol);
          })
          .then(() => {
            // Find the container element to refresh
            const container = containerElement.closest('.watchlist-settings');
            if (container) {
              initializeWatchlistSettings(container);
            }
          })
          .catch(error => {
            console.error('Failed to add symbol:', error);
            alert('Failed to add symbol: ' + error.message);
          });
      }}
      maxResults={6}
      placeholder="Search and add symbol (e.g. AAPL)"
      autoFocus={true}
    />
  );
}