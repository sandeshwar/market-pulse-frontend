import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import { watchlistService } from '../../../services/watchlistService.js';
import { useState, useEffect } from 'react';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';
import { createElementFromHTML } from '../../../utils/dom.js';

function createWatchlistItem({ symbol, name, price, change, changePercent }) {
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
            ${isPositive ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function createWatchlistCard({ title = 'My Watchlist' }) {
  let isMounted = true;

  // Create initial card with loading state
  const cardElement = createElementFromHTML(createCard({
    title,
    icon: ICONS.star,
    content: '<div class="loading">Loading watchlist...</div>'
  }));

  // Function to safely update card content
  const updateCardContent = (content) => {
    if (!isMounted) return false;
    const contentElement = cardElement?.querySelector('.card__content');
    if (!contentElement) {
      console.error('Card content element not found');
      return false;
    }
    contentElement.innerHTML = content;
    return true;
  };

  const updateWatchlist = async () => {
    if (!isMounted) return;

    try {
      const watchlists = await watchlistService.getWatchlists();
      const activeWatchlist = watchlists?.[0];

      // If no watchlist exists, show create button
      if (!watchlists.length) {
        const content = `
          <div class="empty-state">
            <p>No watchlist created yet</p>
            <button class="btn btn--primary" data-action="createWatchlist">
              <i data-feather="${ICONS.plus}"></i>
              Create Watchlist
            </button>
          </div>
        `;
        updateCardContent(content);
        await replaceIcons();
        return;
      }

      // If watchlist exists but has no symbols
      if (!activeWatchlist.symbols?.length) {
        const content = `
          <div class="empty-state">
            <p>No stocks in watchlist</p>
            <p class="hint">Add stocks in Settings → Watchlist</p>
          </div>
        `;
        updateCardContent(content);
        return;
      }
      
      // Get quotes for all symbols
      const stocksWithQuotes = await Promise.all(
        activeWatchlist.symbols.map(async (symbol) => {
          try {
            const quote = await marketDataProvider.getQuote(symbol);
            if (!quote) return null;
            
            return {
              symbol,
              name: quote.name || symbol,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent
            };
          } catch (error) {
            console.error(`Error fetching quote for ${symbol}:`, error);
            return null;
          }
        })
      );

      if (!isMounted) return;

      const validStocks = stocksWithQuotes.filter(stock => stock !== null);
      const content = `
        <div class="watchlist">
          ${validStocks.map(stock => createWatchlistItem(stock)).join('')}
        </div>
      `;

      if (updateCardContent(content)) {
        await replaceIcons();
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
      if (isMounted) {
        updateCardContent('<div class="error">Failed to update watchlist</div>');
      }
    }
  };

  try {
    // Initial load
    await updateWatchlist();

    // Add watchlist service listener for updates
    watchlistService.addListener(updateWatchlist);
  } catch (error) {
    console.error('Error creating watchlist card:', error);
    updateCardContent('<div class="error">Failed to load watchlist</div>');
  }

  // Add cleanup method to the card
  cardElement.cleanup = () => {
    isMounted = false;
    watchlistService.removeListener(updateWatchlist);
  };

  return cardElement;
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