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
import { DEFAULT_REFRESH_INTERVAL } from '../../../constants/marketConstants.js';
import { SortDropdownReact } from '../../common/SortDropdown/SortDropdownReact.jsx';

function createWatchlistItem({ symbol, name, price, change, changePercent, market = '', type = '' }) {
    const isPositive = change >= 0;
    const changeClass = isPositive ? 'positive' : 'negative';
    return `
    <div class="watchlist-item" data-symbol="${symbol}">
      <div class="watchlist-item-content">
        <div class="stock-info">
          <div class="stock-symbol">${symbol}</div>
          <div class="stock-name">${market} | ${type}</div>
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
    let refreshInterval = null;

    // Create initial card with loading state
    const cardElement = createElementFromHTML(createCard({
        title: 'My Watchlist', // Use 'My Watchlist' for consistency with React component
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

            // Get quotes for all symbols in a single API call
            let stocksWithQuotes = [];
            try {
                // Use the new bulk method to fetch all symbols at once
                const quotes = await marketDataProvider.getMultipleStocks(watchlist.symbols);

                // Log the quotes we received to help debug
                console.log('Quotes received from marketDataProvider:', quotes);

                // Transform the response into the expected format
                stocksWithQuotes = watchlist.symbols.map((symbol, index) => {
                    // Try to find the quote by exact symbol match first
                    let quote = quotes[symbol];
                    let matchingSymbolKey = null;

                    // If not found, try to find by checking if any returned symbol contains this symbol
                    // This handles cases where the API returns "AAPL.US" but the watchlist has "AAPL"
                    if (!quote) {
                        matchingSymbolKey = Object.keys(quotes).find(key =>
                            key.includes(symbol) || symbol.includes(key.split('.')[0])
                        );

                        if (matchingSymbolKey) {
                            console.log(`Found matching symbol: ${matchingSymbolKey} for requested symbol: ${symbol}`);
                            quote = quotes[matchingSymbolKey];
                        }
                    }

                    if (!quote) {
                        console.warn(`No quote data found for symbol: ${symbol}`);
                        return null;
                    }

                    console.log(`Processing quote for ${symbol}:`, quote);

                    // Get stored symbol data if available
                    const symbolData = watchlist.symbolsData && watchlist.symbolsData[index]
                        ? watchlist.symbolsData[index]
                        : null;

                    // Extract market from stored data, symbol, or default to US
                    const market = symbolData?.exchange ||
                                  quote.market ||
                                  (matchingSymbolKey && matchingSymbolKey.includes('.') ?
                                   matchingSymbolKey.split('.')[1] : 'US');

                    // Extract asset type from stored data or default to Stock
                    const assetType = symbolData?.assetType || quote.type || 'Stock';

                    return {
                        symbol,
                        name: quote.name || symbol,
                        price: quote.price,
                        change: quote.change,
                        changePercent: quote.changePercent,
                        market: market,
                        type: assetType
                    };
                });
            } catch (error) {
                console.error(`Error fetching quotes for watchlist:`, error);
                stocksWithQuotes = [];
            }

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

        // Set up auto-refresh interval using the DEFAULT_REFRESH_INTERVAL from marketConstants.js
        refreshInterval = setInterval(updateWatchlist, DEFAULT_REFRESH_INTERVAL);
        console.log(`Watchlist auto-refresh enabled with interval: ${DEFAULT_REFRESH_INTERVAL}ms`);
    } catch (error) {
        console.error('Error creating watchlist card:', error);
        updateCardContent('<div class="error">Failed to load watchlist</div>');
    }

    // Add cleanup method to the card
    cardElement.cleanup = () => {
        isMounted = false;
        watchlistService.removeListener(updateWatchlist);

        // Clear the refresh interval when the component is unmounted
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
            console.log('Watchlist auto-refresh disabled');
        }
    };

    return cardElement;
}

export function WatchlistCard({ title = 'Watchlist' }) {
    const [watchlistData, setWatchlistData] = useState(null);
    const [stocksData, setStocksData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [sortField, setSortField] = useState('symbol'); // Default sort field
    const [sortDirection, setSortDirection] = useState('asc'); // Default sort direction
    const MAX_RETRIES = 3;

    // Using the shared ensureDefaultWatchlist function from watchlistUtils.js

    // Load watchlist data on component mount
    const loadWatchlistData = async () => {
        try {
            // First check if any watchlists exist
            const watchlists = await watchlistService.getWatchlists();

            if (watchlists.length === 0) {
                // No watchlists exist, create the default one
                const newWatchlist = await watchlistService.createWatchlist(DEFAULT_WATCHLIST_NAME);
                setWatchlistData(newWatchlist);
            } else {
                // Use the first watchlist (we only support one watchlist for now)
                setWatchlistData(watchlists[0]);
            }
            // Reset retry count on success
            setRetryCount(0);
        } catch (error) {
            console.error('Failed to load watchlist data:', error);
            setError('Failed to load watchlist data');
            // Try to create the default watchlist as a fallback
            try {
                const newWatchlist = await watchlistService.createWatchlist(DEFAULT_WATCHLIST_NAME);
                setWatchlistData(newWatchlist);
                // Reset retry count on success
                setRetryCount(0);
            } catch (fallbackError) {
                console.error('Failed to create default watchlist:', fallbackError);
                setError('Failed to load or create watchlist');

                // Only show alert if we've exhausted retries
                if (retryCount >= MAX_RETRIES) {
                    alert('Failed to load or create watchlist. Please try refreshing the page.');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch stock data for watchlist symbols
    const fetchStockData = async () => {
        if (!watchlistData || !watchlistData.symbols || watchlistData.symbols.length === 0) {
            setStocksData([]);
            return;
        }

        try {
            const quotes = await marketDataProvider.getMultipleStocks(watchlistData.symbols);

            // Log the quotes we received to help debug (matching the original component)
            console.log('Quotes received from marketDataProvider:', quotes);

            // Transform the response into the expected format
            const stocksWithQuotes = watchlistData.symbols.map((symbol, index) => {
                // Try to find the quote by exact symbol match first
                let quote = quotes[symbol];
                let matchingSymbolKey = null;

                // If not found, try to find by checking if any returned symbol contains this symbol
                // This handles cases where the API returns "AAPL.US" but the watchlist has "AAPL"
                if (!quote) {
                    matchingSymbolKey = Object.keys(quotes).find(key =>
                        key.includes(symbol) || symbol.includes(key.split('.')[0])
                    );

                    if (matchingSymbolKey) {
                        console.log(`Found matching symbol: ${matchingSymbolKey} for requested symbol: ${symbol}`);
                        quote = quotes[matchingSymbolKey];
                    }
                }

                if (!quote) {
                    console.warn(`No quote data found for symbol: ${symbol}`);
                    return null;
                }

                console.log(`Processing quote for ${symbol}:`, quote);

                // Get stored symbol data if available
                const symbolData = watchlistData.symbolsData && watchlistData.symbolsData[index]
                    ? watchlistData.symbolsData[index]
                    : null;

                // Extract market from stored data, symbol, or default to US
                const market = symbolData?.exchange ||
                              quote.market ||
                              (matchingSymbolKey && matchingSymbolKey.includes('.') ?
                               matchingSymbolKey.split('.')[1] : 'US');

                // Extract asset type from stored data or default to Stock
                const assetType = symbolData?.assetType || quote.type || 'Stock';

                return {
                    symbol,
                    name: quote.name || symbol,
                    price: quote.price,
                    change: quote.change,
                    changePercent: quote.changePercent,
                    market: market,
                    type: assetType
                };
            });

            const validStocks = stocksWithQuotes.filter(stock => stock !== null);
            setStocksData(validStocks);

            // Reset retry count on success
            setRetryCount(0);
        } catch (error) {
            console.error('Error fetching stock data:', error);
            setError('Failed to fetch stock data');

            // Implement retry logic similar to the original component
            if (retryCount < MAX_RETRIES) {
                const newRetryCount = retryCount + 1;
                setRetryCount(newRetryCount);
                console.log(`Retrying update (${newRetryCount}/${MAX_RETRIES})...`);
                // We'll retry in the next interval cycle
            }
        }
    };

    // Initial data load effect
    useEffect(() => {
        loadWatchlistData();

        // Add watchlist service listener for updates
        watchlistService.addListener(loadWatchlistData);

        // Cleanup listener on component unmount
        return () => watchlistService.removeListener(loadWatchlistData);
    }, []);

    // Effect to fetch stock data when watchlist data changes
    useEffect(() => {
        if (watchlistData) {
            fetchStockData();
        }
    }, [watchlistData]);

    // Set up auto-refresh interval
    useEffect(() => {
        console.log(`Watchlist auto-refresh enabled with interval: ${DEFAULT_REFRESH_INTERVAL}ms`);

        const refreshInterval = setInterval(() => {
            if (watchlistData && watchlistData.symbols && watchlistData.symbols.length > 0) {
                console.log('Auto-refreshing watchlist data...');
                fetchStockData();
            }
        }, DEFAULT_REFRESH_INTERVAL);

        // Cleanup interval on component unmount
        return () => {
            clearInterval(refreshInterval);
            console.log('Watchlist auto-refresh disabled');
        };
    }, [watchlistData]);

    const handleSymbolSelect = (symbol) => {
        // If watchlistData is not available, ensure the default watchlist exists first
        if (!watchlistData) {
            ensureDefaultWatchlist()
                .then(watchlist => {
                    // Pass the full symbol object to store additional data
                    return watchlistService.addSymbol(DEFAULT_WATCHLIST_NAME, symbol);
                })
                .then(() => {
                    // Refresh watchlist data
                    loadWatchlistData();
                })
                .catch((error) => {
                    console.error('Failed to add symbol:', error);
                    alert('Failed to add symbol: ' + error.message);
                });
            return;
        }

        // Use the watchlist name from watchlistData, or fall back to DEFAULT_WATCHLIST_NAME
        const watchlistName = watchlistData.name || DEFAULT_WATCHLIST_NAME;

        // Pass the full symbol object to store additional data
        watchlistService.addSymbol(watchlistName, symbol)
            .then(() => {
                // Refresh watchlist data
                loadWatchlistData();
            })
            .catch((error) => {
                console.error('Failed to add symbol:', error);
                alert('Failed to add symbol: ' + error.message);
            });
    };

    // Handle sort change
    const handleSortChange = (field) => {
        if (field === sortField) {
            // Toggle direction if clicking the same field
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new field and reset to ascending
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Get sorted stocks data
    const getSortedStocksData = () => {
        if (!stocksData || stocksData.length === 0) return [];

        return [...stocksData].sort((a, b) => {
            let aValue, bValue;

            // Determine which field to sort by
            switch (sortField) {
                case 'symbol':
                    aValue = a.symbol;
                    bValue = b.symbol;
                    break;
                case 'price':
                    aValue = a.price || 0;
                    bValue = b.price || 0;
                    break;
                case 'change':
                    aValue = a.change || 0;
                    bValue = b.change || 0;
                    break;
                case 'changePercent':
                    aValue = a.changePercent || 0;
                    bValue = b.changePercent || 0;
                    break;
                default:
                    aValue = a.symbol;
                    bValue = b.symbol;
            }

            // Apply sort direction
            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    };

    // We've removed the renderSortControls function as we're now using SortDropdownReact in the header

    // Render watchlist items
    const renderWatchlistItems = () => {
        if (loading) {
            return <div className="loading">Loading watchlist...</div>;
        }

        if (error) {
            return <div className="error">{error}</div>;
        }

        if (!watchlistData || !watchlistData.symbols || watchlistData.symbols.length === 0) {
            return (
                <div className="empty-state">
                    <p>No stocks in watchlist</p>
                    <p className="hint">Use the search box below to add stocks</p>
                </div>
            );
        }

        if (stocksData.length === 0) {
            return <div className="loading">Loading stock data...</div>;
        }

        const sortedStocks = getSortedStocksData();

        return (
            <div className="watchlist">
                {sortedStocks.map(stock => (
                    <div key={stock.symbol} className="watchlist-item" data-symbol={stock.symbol}>
                        <div className="watchlist-item-content">
                            <div className="stock-info">
                                <div className="stock-symbol">{stock.symbol}</div>
                                <div className="stock-name">
                                    {stock.market || 'US'} | {stock.type || 'Stock'}
                                </div>
                            </div>
                            <div className="stock-price">
                                <div>{stock.price}</div>
                                <div className={`stock-change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                                    {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Define sort fields
    const sortFields = [
        { id: 'symbol', label: 'Symbol' },
        { id: 'price', label: 'Price' },
        { id: 'change', label: 'Change' },
        { id: 'changePercent', label: 'Percent Change' }
    ];

    return (
        <div className="watchlist-card card">
            <div className="card__header">
                <div className="card__title">
                    <i data-feather="star"></i>
                    {title}
                </div>
                <div className="card__actions">
                    <SortDropdownReact
                        fields={sortFields}
                        defaultField={sortField}
                        defaultDirection={sortDirection}
                        onSort={(field, direction) => {
                            setSortField(field);
                            setSortDirection(direction);
                        }}
                    />
                </div>
            </div>
            <div className="card__content">
                {renderWatchlistItems()}
            </div>
        </div>
    );
}