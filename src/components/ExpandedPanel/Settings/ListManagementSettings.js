import { createButton } from '../../common/Button/Button.js';
import { createInput } from '../../common/Input/Input.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';

const buttonHandlers = {
  editWatchlist: function() {
    console.log('Edit watchlist');
  },
  deleteWatchlist: function() {
    console.log('Delete watchlist');
  }
};

function createListHeader({ name, actions = [] }) {
  return `
    <div class="list-header">
      <h4 class="list-title">${name}</h4>
      ${actions.length ? `
        <div class="list-actions">
          ${actions.map(action => createButton({
            icon: ICONS[action.icon],
            title: action.title,
            variant: `icon${action.icon === 'trash' ? ' btn--delete' : action.icon === 'edit' ? ' btn--edit' : ''}`,
            onClick: buttonHandlers[action.handler]  // Use the handler name directly
          })).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function createListItem({ name, items, actions = [], showFooter = true }) {
  const itemsList = items.map(item => `
    <div class="list-item">
      <div class="list-item-content">
        <div class="list-item-symbol">${item.symbol}</div>
        <div class="list-item-name">${item.name}</div>
      </div>
      <button class="btn btn--icon btn--delete" title="Remove item">
        <i data-feather="${ICONS.trash}"></i>
      </button>
    </div>
  `).join('');

  return `
    <div class="list-group">
      ${actions.length ? createListHeader({ name, actions }) : ''}
      <div class="list-items">
        ${itemsList}
      </div>
      ${showFooter ? `
        <div class="list-footer">
          ${createInput({
            placeholder: 'Add symbol...',
            icon: ICONS.search
          })}
        </div>
      ` : ''}
    </div>
  `;
}

export function createListManagementSettings() {
  const watchlists = [
    {
      name: 'My Watchlist',
      actions: [
        { icon: 'edit', title: 'Edit watchlist', onClick: 'editWatchlist()' },
        { icon: 'trash', title: 'Delete watchlist', onClick: 'deleteWatchlist()' }
      ],
      items: [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corp.' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' }
      ]
    }
  ];

  const marketIndices = [
    {
      name: 'Market Indices',
      actions: [],
      items: [
        { symbol: 'S&P 500', name: 'Standard & Poor\'s 500' },
        { symbol: 'Nasdaq', name: 'Nasdaq Composite' },
        { symbol: 'Dow Jones', name: 'Dow Jones Industrial Average' }
      ],
      showFooter: true
    }
  ];

  return `
    <div class="list-management">
      ${createCard({
        title: 'Watchlists',
        icon: ICONS.star,
        content: `
          <div class="lists-container">
            ${watchlists.map(list => createListItem(list)).join('')}
            ${createButton({
              text: 'Create New Watchlist',
              icon: ICONS.star,
              variant: 'primary',
              fullWidth: true
            })}
          </div>
        `
      })}
      
      ${createCard({
        title: 'Market Indices',
        icon: ICONS.barChart2,
        content: `
          <div class="lists-container">
            ${marketIndices.map(list => createListItem(list)).join('')}
          </div>
        `
      })}
    </div>
  `;
}