import { createButton } from '../../common/Button/Button.js';
import { createInput } from '../../common/Input/Input.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { watchlistService } from '../../../services/watchlistService.js';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';
import { replaceIcons } from '../../../utils/feather.js';

let settingsElement = null;

async function handleEditWatchlist(name) {
  // For now, just show a modal or alert
  alert(`Edit watchlist: ${name}`);
}

async function handleDeleteWatchlist(name) {
  if (confirm(`Are you sure you want to delete the watchlist "${name}"?`)) {
    try {
      await watchlistService.deleteWatchlist(name);
      await updateWatchlistsUI();
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      alert('Failed to delete watchlist');
    }
  }
}

async function handleAddSymbol(watchlistName, symbol) {
  try {
    await watchlistService.addSymbol(watchlistName, symbol);
    await updateWatchlistsUI();
  } catch (error) {
    console.error('Error adding symbol:', error);
    alert('Failed to add symbol to watchlist');
  }
}

async function handleRemoveSymbol(watchlistName, symbol) {
  try {
    await watchlistService.removeSymbol(watchlistName, symbol);
    await updateWatchlistsUI();
  } catch (error) {
    console.error('Error removing symbol:', error);
    alert('Failed to remove symbol from watchlist');
  }
}

async function handleCreateWatchlist() {
  const name = prompt('Enter watchlist name:');
  if (name) {
    try {
      await watchlistService.createWatchlist(name);
      await updateWatchlistsUI();
    } catch (error) {
      console.error('Error creating watchlist:', error);
      alert('Failed to create watchlist');
    }
  }
}

function createListHeader({ name, actions = [] }) {
  return `
    <div class="list-header">
      <h4 class="list-title">${name}</h4>
      ${actions.length ? `
        <div class="list-actions">
          ${actions.map(action => createButton({
            'data-action': action.handler,
            'data-watchlist-name': name,
            icon: ICONS[action.icon],
            title: action.title,
            variant: `icon${action.icon === 'trash' ? ' btn--delete' : action.icon === 'edit' ? ' btn--edit' : ''}`,
          })).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

async function createListItem({ name, symbols = [], actions = [], showFooter = true }) {
  // Get real-time quotes for all symbols
  const symbolsWithQuotes = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await marketDataProvider.getQuote(symbol);
        return {
          symbol,
          name: quote.name || symbol,
          price: quote.price.toFixed(2)
        };
      } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return { symbol, name: symbol, price: 'N/A' };
      }
    })
  );

  const itemsList = symbolsWithQuotes.map(item => `
    <div class="list-item">
      <div class="list-item-content">
        <div class="list-item-symbol">${item.symbol}</div>
        <div class="list-item-name">${item.name}</div>
        <div class="list-item-price">${item.price}</div>
      </div>
      <button class="btn btn--icon btn--delete" data-action="removeSymbol" data-watchlist-name="${name}" data-symbol="${item.symbol}" title="Remove item">
        <i data-feather="${ICONS.trash}"></i>
      </button>
    </div>
  `).join('');

  const listContent = `
    <div class="list-group">
      ${actions.length ? createListHeader({ name, actions }) : ''}
      <div class="list-items">
        ${symbols.length ? itemsList : '<div class="empty-state">No symbols in watchlist</div>'}
      </div>
      ${showFooter ? `
        <div class="list-footer">
          <div class="input-wrapper">
            <i data-feather="${ICONS.search}" class="input-icon"></i>
            <input 
              type="text" 
              class="input-field"
              placeholder="Add symbol..."
              data-watchlist-name="${name}"
              onkeyup="if(event.key === 'Enter' && this.value) {
                const button = this.nextElementSibling;
                if (button) {
                  button.click();
                  this.value = '';
                }
              }"
            />
            <button class="btn btn--icon" data-action="addSymbol" data-watchlist-name="${name}">
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
    
    const watchlistsContent = await Promise.all(watchlists.map(watchlist => 
      createListItem({
        name: watchlist.name,
        symbols: watchlist.symbols,
        actions: [
          { icon: 'edit', title: 'Edit watchlist', handler: 'editWatchlist' },
          { icon: 'trash', title: 'Delete watchlist', handler: 'deleteWatchlist' }
        ]
      })
    ));

    const content = `
      <div class="lists-container">
        ${watchlists.length ? watchlistsContent.join('') : '<div class="empty-state">No watchlists yet</div>'}
        ${createButton({
          text: 'Create New Watchlist',
          icon: ICONS.plus,
          variant: 'primary',
          fullWidth: true,
          onClick: 'createWatchlist'
        })}
      </div>
    `;

    contentElement.innerHTML = content;
    await replaceIcons();
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

  // Listen for watchlist update events
  const settingsPage = document.querySelector('.settings-page');
  if (settingsPage) {
    settingsPage.addEventListener('watchlist-updated', async () => {
      await updateWatchlistsUI();
    });
  }

  // Initialize after render
  setTimeout(async () => {
    await updateWatchlistsUI();
  }, 0);

  return settingsElement;
}