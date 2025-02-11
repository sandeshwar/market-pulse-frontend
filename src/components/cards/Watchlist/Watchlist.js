import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';

function createWatchlistItem({ symbol, name, price, change, changePercent }, index) {
  const isPositive = change >= 0;
  const changeClass = isPositive ? 'positive' : 'negative';
  return `
    <div class="watchlist-item" data-symbol="${symbol}">
      <div class="watchlist-item-content">
        <div class="stock-info">
          <div class="stock-symbol">${symbol}</div>
          <div class="stock-name">${name}</div>
        </div>
        <div class="stock-price">
          <div>${price}</div>
          <div class="stock-change ${changeClass}">
            ${isPositive ? '+' : ''}${change} (${changePercent}%)
          </div>
        </div>
      </div>
    </div>
  `;
}

// TODO: Add watchlist management
export function createWatchlistCard({ title = 'My Watchlist' }) {
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: '173.75', change: 2.34, changePercent: 1.37 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: '338.11', change: -4.22, changePercent: -1.23 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: '125.30', change: 1.15, changePercent: 0.93 }
  ];

  const content = `
    <div class="watchlist">
      ${stocks.map((stock, index) => createWatchlistItem(stock, index)).join('')}
    </div>
  `;

  const card = createCard({
    title,
    icon: ICONS.star,
    content
  });

  // Initialize icons after render
  setTimeout(async () => {
    await replaceIcons();
  }, 0);

  return card;
}