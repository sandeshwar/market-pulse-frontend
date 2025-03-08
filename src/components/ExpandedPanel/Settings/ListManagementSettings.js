import { createButton } from '../../common/Button/Button.js';
import { createInput } from '../../common/Input/Input.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { watchlistService } from '../../../services/watchlistService.js';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';
import { replaceIcons } from '../../../utils/feather.js';

let settingsElement = null;
let suggestionTimeout = null;

function setupSymbolInputListeners(input, watchlistName) {
  // Remove any existing listeners first
  input.removeEventListener('input', input._inputHandler);
  input.removeEventListener('keyup', input._keyupHandler);

  // Handle input changes for suggestions
  input._inputHandler = (e) => {
    clearTimeout(suggestionTimeout);
    suggestionTimeout = setTimeout(() => {
      showSymbolSuggestions(input, watchlistName);
    }, 300);
  };

  // Handle enter key
  input._keyupHandler = (e) => {
    if (e.key === 'Enter' && input.value) {
      const button = input.closest('.input-wrapper').querySelector('[data-action="addSymbol"]');
      if (button) {
        button.click();
        input.value = '';
      }
    }
  };

  // Add the listeners
  input.addEventListener('input', input._inputHandler);
  input.addEventListener('keyup', input._keyupHandler);
}

async function showSymbolSuggestions(input, watchlistName) {
  const query = input.value.trim();

  // Remove existing suggestions and clean up event listeners
  const existingSuggestions = document.querySelector('.symbol-suggestions');
  if (existingSuggestions) {
    existingSuggestions.remove();
    input.removeEventListener('keydown', handleSuggestionKeyNavigation);
  }

  if (query.length < 2) return;

  try {
    const results = await marketDataProvider.searchSymbols(query);
    if (!results.length) return;

    // Limit to 6 suggestions
    const limitedResults = results.slice(0, 6);

    const suggestionsEl = document.createElement('div');
    suggestionsEl.className = 'symbol-suggestions';

    suggestionsEl.innerHTML = limitedResults.map(result => `
      <div class="suggestion-item" data-symbol="${result.symbol}" data-watchlist="${watchlistName}">
        <span class="suggestion-symbol">${result.symbol}</span>
        <span class="suggestion-name">${result.name || 'Unknown'}</span>
      </div>
    `).join('');

    // Add click handlers for suggestions
    suggestionsEl.addEventListener('click', async (e) => {
      const item = e.target.closest('.suggestion-item');
      if (!item) return;

      const symbol = item.dataset.symbol;
      const watchlistName = item.dataset.watchlist;

      // Set the input value to the selected symbol
      input.value = symbol;

      // Clear suggestions and remove keyboard event listener
      suggestionsEl.remove();
      input.removeEventListener('keydown', handleSuggestionKeyNavigation);

      // Add the symbol
      const addButton = input.closest('.input-wrapper').querySelector('[data-action="addSymbol"]');
      if (addButton) {
        addButton.click();
        // Clear input after adding
        input.value = '';
      }
    });

    // Position and show suggestions
    const inputContainer = input.closest('.input-container');
    if (inputContainer) {
      inputContainer.appendChild(suggestionsEl);
    } else {
      input.parentElement.appendChild(suggestionsEl);
    }

    // Add keyboard navigation for suggestions
    input.addEventListener('keydown', handleSuggestionKeyNavigation);

    // Highlight the first item by default
    const firstItem = suggestionsEl.querySelector('.suggestion-item');
    if (firstItem) {
      firstItem.classList.add('selected');
    }
  } catch (error) {
    console.error('Error fetching symbol suggestions:', error);
  }
}

// Handle keyboard navigation for suggestions
function handleSuggestionKeyNavigation(e) {
  const suggestions = document.querySelector('.symbol-suggestions');
  if (!suggestions) return;

  const items = suggestions.querySelectorAll('.suggestion-item');
  if (!items.length) return;

  // Find currently selected item
  const selectedItem = suggestions.querySelector('.suggestion-item.selected');
  let selectedIndex = -1;

  if (selectedItem) {
    selectedIndex = Array.from(items).indexOf(selectedItem);
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (selectedIndex < items.length - 1) {
        if (selectedItem) selectedItem.classList.remove('selected');
        items[selectedIndex + 1].classList.add('selected');
        items[selectedIndex + 1].scrollIntoView({ block: 'nearest' });
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (selectedIndex > 0) {
        if (selectedItem) selectedItem.classList.remove('selected');
        items[selectedIndex - 1].classList.add('selected');
        items[selectedIndex - 1].scrollIntoView({ block: 'nearest' });
      }
      break;

    case 'Enter':
      if (selectedItem) {
        e.preventDefault();
        selectedItem.click();
      }
      break;

    case 'Escape':
      e.preventDefault();
      suggestions.remove();
      break;
  }
}

// Add click outside handler to close suggestions
document.addEventListener('click', (e) => {
  if (!e.target.closest('.input-container')) {
    const suggestions = document.querySelector('.symbol-suggestions');
    if (suggestions) {
      suggestions.remove();

      // Also remove keyboard event listener from the input
      const symbolInput = document.querySelector('.symbol-input');
      if (symbolInput) {
        symbolInput.removeEventListener('keydown', handleSuggestionKeyNavigation);
      }
    }
  }
});

async function createListItem({ name, symbols = [], actions = [], showFooter = true }) {
  // Remove any existing suggestions when re-rendering
  const existingSuggestions = document.querySelector('.symbol-suggestions');
  if (existingSuggestions) {
    existingSuggestions.remove();
  }
  
  // Get real-time quotes for all symbols
  const symbolsWithQuotes = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await marketDataProvider.getQuote(symbol);
        return {
          symbol,
          name: quote?.name || symbol,
          price: quote?.price?.toFixed(2) || 'N/A'
        };
      } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return { symbol, name: symbol, price: 'N/A' };
      }
    })
  );

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
          <div class="input-wrapper">
            <div class="input-container">
              <i data-feather="${ICONS.search}" class="input-icon"></i>
              <input 
                type="text" 
                class="input-field symbol-input"
                placeholder="Add symbol..."
                data-watchlist-name="${name}"
                aria-label="Enter stock symbol to add"
              />
            </div>
            <button class="btn btn--icon btn--primary" 
              data-action="addSymbol" 
              data-watchlist-name="${name}" 
              title="Add symbol"
              aria-label="Add symbol to watchlist">
              <i data-feather="${ICONS.plus}"></i>
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  return listContent;
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
        actions: [], // Remove edit/delete actions
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

    // Add event listeners to the symbol input after rendering
    const symbolInput = contentElement.querySelector('.symbol-input');
    if (symbolInput) {
      const watchlistName = symbolInput.dataset.watchlistName;
      setupSymbolInputListeners(symbolInput, watchlistName);
    }
  } catch (error) {
    console.error('Error updating watchlists UI:', error);
    contentElement.innerHTML = '<div class="error">Failed to load watchlists</div>';
  }
}

export function createListManagementSettings() {
  // Create element with loading state first
  settingsElement = document.createElement('div');
  settingsElement.innerHTML = `
    <div class="list-management">
      ${createCard({
        title: 'Watchlists',
        icon: ICONS.star,
        content: '<div class="loading">Loading watchlists...</div>'
      })}
    </div>
  `;
  settingsElement = settingsElement.firstElementChild;

  // Add direct watchlist service listener
  const handleWatchlistUpdate = async () => {
    await updateWatchlistsUI();
  };
  watchlistService.addListener(handleWatchlistUpdate);

  // Also listen for watchlist update events for backward compatibility
  const settingsPage = document.querySelector('.settings-page');
  if (settingsPage) {
    settingsPage.addEventListener('watchlist-updated', handleWatchlistUpdate);
  }

  // Cleanup function
  settingsElement.cleanup = () => {
    // Remove any lingering suggestions
    const existingSuggestions = document.querySelector('.symbol-suggestions');
    if (existingSuggestions) {
      existingSuggestions.remove();
    }

    // Clear debounce timeout
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }

    // Remove input event listeners
    const symbolInput = settingsElement.querySelector('.symbol-input');
    if (symbolInput) {
      symbolInput.removeEventListener('input', symbolInput._inputHandler);
      symbolInput.removeEventListener('keyup', symbolInput._keyupHandler);
      symbolInput.removeEventListener('keydown', handleSuggestionKeyNavigation);
    }

    watchlistService.removeListener(handleWatchlistUpdate);
    if (settingsPage) {
      settingsPage.removeEventListener('watchlist-updated', handleWatchlistUpdate);
    }
  };

  // Initialize after render
  setTimeout(async () => {
    await updateWatchlistsUI();
  }, 0);

  return settingsElement;
}

// No need to expose these variables globally