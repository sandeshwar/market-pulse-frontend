import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import { useState, useEffect } from 'react';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';

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

export function SymbolSearch({ onSelect }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const searchSymbols = async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }
            
            setLoading(true);
            const searchResults = await marketDataProvider.searchSymbols(query);
            setResults(searchResults);
            setLoading(false);
        };

        const debounceTimer = setTimeout(searchSymbols, 300);
        return () => clearTimeout(debounceTimer);
    }, [query]);

    return (
        <div className="symbol-search">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stocks (e.g. AAPL, Apple)"
                className="search-input"
            />
            
            {loading && <div className="loading">Searching...</div>}
            
            <ul className="search-results">
                {results.map(result => (
                    <li 
                        key={result.symbol}
                        onClick={() => onSelect(result)}
                        className="search-result-item"
                    >
                        <span className="symbol">{result.symbol}</span>
                        <span className="name">{result.name}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}