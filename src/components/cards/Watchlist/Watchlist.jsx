import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import { watchlistService } from '../../../services/watchlistService.js';
import { useState, useEffect } from 'react';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';
import { createElementFromHTML } from '../../../utils/dom.js';
import React from 'react';
import { SymbolSearch } from '../../common/SymbolSearch/SymbolSearch.jsx';
import { DEFAULT_WATCHLIST_NAME, ensureDefaultWatchlist } from '../../../utils/watchlistUtils.js';

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

export async function createWatchlistCard({ title = 'Watchlist' }) {
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

    // Using the shared ensureDefaultWatchlist function from watchlistUtils.js

    const updateWatchlist = async () => {
        if (!isMounted) return;

        try {
            // Ensure the default watchlist exists
            const watchlist = await ensureDefaultWatchlist();

            // If watchlist has no symbols
            if (!watchlist.symbols?.length) {
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
                watchlist.symbols.map(async (symbol) => {
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

export function WatchlistCard() {
    const [watchlistData, setWatchlistData] = useState(null);

    // Using the shared ensureDefaultWatchlist function from watchlistUtils.js

    // Load watchlist data on component mount
    const loadWatchlistData = async () => {
        try {
            const watchlist = await ensureDefaultWatchlist();
            setWatchlistData(watchlist);
        } catch (error) {
            console.error('Failed to load watchlist data:', error);
        }
    };

    useEffect(() => {
        loadWatchlistData();

        // Add watchlist service listener for updates
        watchlistService.addListener(loadWatchlistData);

        // Cleanup listener on component unmount
        return () => watchlistService.removeListener(loadWatchlistData);
    }, []);

    const handleSymbolSelect = (symbol) => {
        if (!watchlistData) return;

        watchlistService.addSymbol(watchlistData.name, symbol.symbol)
            .then(() => {
                // Refresh watchlist data
                loadWatchlistData();
            })
            .catch((error) => {
                console.error('Failed to add symbol:', error);
            });
    };

    return (
        <div className="watchlist-card">
            <SymbolSearch
                onSelect={handleSymbolSelect}
                maxResults={10}
                placeholder="Search for a stock or ETF"
            />
        </div>
    );
}