import React from 'react';
import { createRoot } from 'react-dom/client';
import { SymbolSearch } from '../../common/SymbolSearch/SymbolSearch.jsx';
import { watchlistService } from '../../../services/watchlistService.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import { ensureDefaultWatchlist, DEFAULT_WATCHLIST_NAME } from '../../../utils/watchlistUtils.js';

export async function createSettingsPage() {
  // Create a wrapper element
  const settingsPage = document.createElement('div');
  settingsPage.className = 'settings-page';

  // Create watchlist card
  const watchlistCard = document.createElement('div');
  watchlistCard.className = 'watchlist-settings';

  // Add card with initial loading state
  watchlistCard.innerHTML = createCard({
    title: 'Watchlist',
    icon: ICONS.star,
    content: '<div class="loading">Loading watchlist...</div>'
  });

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
          <h3>Symbols</h3>
          <ul class="symbols-list">
            ${watchlist.symbols.map(symbol => `
              <li class="symbol-item">
                <span class="symbol-name">${symbol}</span>
                <button class="btn btn--icon btn--delete"
                  data-action="removeSymbol"
                  data-symbol="${symbol}">
                  <i data-feather="${ICONS.trash}"></i>
                </button>
              </li>
            `).join('')}
          </ul>
        </div>
      `
      : '<div class="empty-state">No symbols in watchlist</div>';

    // Render the content
    cardContent.innerHTML = `
      <div class="watchlist-content">
        ${symbolsList}
        <div class="symbol-search-container"></div>
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
          await watchlistService.removeSymbol(DEFAULT_WATCHLIST_NAME, symbol);
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
    cardContent.innerHTML = '<div class="error">Failed to load watchlist</div>';
  }
}

function initializeSymbolSearch(containerElement) {
  // Create a React root for the symbol search
  const root = createRoot(containerElement);

  // Render the SymbolSearch component directly
  root.render(
    <SymbolSearch
      onSelect={(symbol) => {
        // Add the symbol to the default watchlist
        watchlistService.addSymbol(DEFAULT_WATCHLIST_NAME, symbol.symbol)
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
      placeholder="Add symbol (e.g. AAPL)"
      autoFocus={true}
    />
  );
}