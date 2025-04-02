import { createButton } from '../../common/Button/Button.js';
import { createInput } from '../../common/Input/Input.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { watchlistService } from '../../../services/watchlistService.js';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';
import { replaceIcons } from '../../../utils/feather.js';
import { SymbolSearch } from '../../SymbolSearch/SymbolSearch';
import React from 'react';
import { createRoot } from 'react-dom/client';

let settingsElement = null;

async function createListItem({ name, symbols = [], actions = [], showFooter = true }) {
  // Get real-time quotes for all symbols in a single API call
  let symbolsWithQuotes = [];

  if (symbols.length > 0) {
    try {
      // Use the new bulk method to fetch all symbols at once
      const quotes = await marketDataProvider.getMultipleStocks(symbols);

      // Transform the response into the expected format
      symbolsWithQuotes = symbols.map(symbol => {
        const quote = quotes[symbol];
        return {
          symbol,
          name: quote?.name || symbol,
          price: quote?.price?.toFixed(2) || 'N/A'
        };
      });
    } catch (error) {
      console.error(`Error fetching quotes for list:`, error);
      // Fallback to basic symbol information if API call fails
      symbolsWithQuotes = symbols.map(symbol => ({
        symbol,
        name: symbol,
        price: 'N/A'
      }));
    }
  }

  const itemsList = symbolsWithQuotes.map(item => `
    <div class="list-item" data-symbol="${item.symbol}" tabindex="0">
      <div class="list-item-content">
        <div class="list-item-info">
          <div class="list-item-symbol" title="${item.symbol}">${item.symbol}</div>
          <div class="list-item-name" title="${item.name}">${item.name}</div>
        </div>
        <div class="list-item-price" title="${item.price}">${item.price}</div>
      </div>
      <div class="list-item-actions">
        <button class="btn btn--icon btn--delete" 
          data-action="removeSymbol" 
          data-watchlist-name="${name}" 
          data-symbol="${item.symbol}" 
          title="Remove ${item.symbol}"
          aria-label="Remove ${item.symbol} from watchlist">
          <i data-feather="${ICONS.trash}"></i>
        </button>
      </div>
    </div>
  `).join('');

  const listContent = `
    <div class="list-group">
      <div class="list-items" role="list">
        ${symbols.length ? itemsList : '<div class="empty-state">No symbols in watchlist</div>'}
      </div>
      ${showFooter ? `
        <div class="list-footer">
          <div class="symbol-search-container"></div>
        </div>
      ` : ''}
    </div>
  `;

  return listContent;
}

async function updateWatchlistDisplay(watchlistName) {
  await updateWatchlistsUI();
}

async function updateWatchlistsUI() {
  if (!settingsElement) return;

  const watchlistCard = settingsElement.querySelector('.card');
  if (!watchlistCard) return;

  const contentElement = watchlistCard.querySelector('.card__content');
  if (!contentElement) return;

  try {
    const watchlists = await watchlistService.getWatchlists();
    let content;
    
    if (watchlists.length === 0) {
      content = `
        <div class="lists-container">
          ${createButton({
            text: 'Create Watchlist',
            icon: ICONS.plus,
            variant: 'primary',
            fullWidth: true,
            onClick: 'createWatchlist'
          })}
        </div>
      `;
    } else {
      // Only show the first watchlist
      const watchlist = watchlists[0];
      const watchlistContent = await createListItem({
        name: watchlist.name,
        symbols: watchlist.symbols,
        actions: [], 
        showFooter: true
      });

      content = `
        <div class="lists-container">
          ${watchlistContent}
        </div>
      `;
    }

    contentElement.innerHTML = content;
    await replaceIcons();

    // Initialize React component after rendering
    const searchContainer = contentElement.querySelector('.symbol-search-container');
    if (searchContainer && watchlists.length > 0) {
      initializeSymbolSearch(searchContainer, watchlists[0].name);
    }
  } catch (error) {
    console.error('Error updating watchlists UI:', error);
    contentElement.innerHTML = '<div class="error">Failed to load watchlists</div>';
  }
}

function initializeSymbolSearch(containerElement, watchlistName) {
  // Create a React root for the symbol search
  const root = createRoot(containerElement);
  
  // Render the SymbolSearch component
  root.render(
    <SymbolSearch 
      onSelect={(symbol) => {
        // Add the symbol to the watchlist
        watchlistService.addSymbol(watchlistName, symbol.symbol)
          .then(() => {
            // Update the UI after adding the symbol
            updateWatchlistDisplay(watchlistName);
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

// export function createListManagementSettings() {
//   // Create element with loading state first
//   settingsElement = document.createElement('div');
//   settingsElement.innerHTML = `
//     <div class="list-management">
//       ${createCard({
//         title: 'Watchlists',
//         icon: ICONS.star,
//         content: '<div class="loading">Loading watchlists...</div>'
//       })}
//     </div>
//   `;
//   settingsElement = settingsElement.firstElementChild;

//   // Add direct watchlist service listener
//   const handleWatchlistUpdate = async () => {
//     await updateWatchlistsUI();
//   };
//   watchlistService.addListener(handleWatchlistUpdate);

//   // Also listen for watchlist update events for backward compatibility
//   const settingsPage = document.querySelector('.settings-page');
//   if (settingsPage) {
//     settingsPage.addEventListener('watchlist-updated', handleWatchlistUpdate);
//   }

//   // Cleanup function
//   settingsElement.cleanup = () => {
//     watchlistService.removeListener(handleWatchlistUpdate);
//     if (settingsPage) {
//       settingsPage.removeEventListener('watchlist-updated', handleWatchlistUpdate);
//     }
//   };

//   // Initialize after render
//   setTimeout(async () => {
//     await updateWatchlistsUI();
//   }, 0);

//   return settingsElement;
// }