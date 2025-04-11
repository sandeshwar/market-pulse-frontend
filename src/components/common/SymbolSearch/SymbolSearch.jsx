import { useState, useEffect, useRef } from 'react';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import { FeatherIcon } from '../FeatherIcon/FeatherIcon.jsx';
import './SymbolSearch.css';

/**
 * Reusable Symbol Search component
 * @param {Object} props
 * @param {Function} props.onSelect - Callback when symbol is selected
 * @param {number} props.maxResults - Maximum number of results to show (default: 10)
 * @param {string} props.placeholder - Placeholder text for the input
 * @param {boolean} props.autoFocus - Whether to autofocus the input
 * @param {string} props.title - Optional title for the component header (default: "Stock Search")
 * @param {boolean} props.showHeader - Whether to show the header (default: true)
 */
export function SymbolSearch({ 
  onSelect, 
  maxResults = 10, 
  placeholder = "Search stocks (e.g. AAPL, Apple)", 
  autoFocus = false,
  title = "Stock Search",
  showHeader = true
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const resultsRef = useRef(null);
    const containerRef = useRef(null);

    // Search for symbols when query changes
    useEffect(() => {
        const searchSymbols = async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const response = await marketDataProvider.searchSymbols(query);

                // Handle different response formats
                // The response should be an array of symbol objects
                const searchResults = Array.isArray(response) ? response : [];

                // Map the results to ensure they have the expected format
                const formattedResults = searchResults.map(item => {
                    const symbol = item.ticker || item.symbol || '';
                    return {
                        symbol: symbol,
                        // Use the symbol as the name if name is not provided
                        name: item.name || symbol,
                        exchange: item.exchange || '',
                        assetType: item.asset_type || item.assetType || ''
                    };
                });

                setResults(formattedResults.slice(0, maxResults));
                // Reset selection to first item when results change
                setSelectedIndex(0);
            } catch (error) {
                console.error('Symbol search error:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search to avoid excessive API calls
        const debounceTimer = setTimeout(searchSymbols, 300);
        return () => clearTimeout(debounceTimer);
    }, [query, maxResults]);

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (results.length === 0) return;

        // Prevent any default behavior that might cause layout shifts
        const preventDefaultKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'];
        if (preventDefaultKeys.includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
        }

        switch (e.key) {
            case 'ArrowDown':
                // Move selection down
                setSelectedIndex(prev => {
                    const newIndex = (prev + 1) % results.length;
                    console.log('Moving selection down to index:', newIndex);
                    return newIndex;
                });
                break;
            case 'ArrowUp':
                // Move selection up
                setSelectedIndex(prev => {
                    const newIndex = (prev - 1 + results.length) % results.length;
                    console.log('Moving selection up to index:', newIndex);
                    return newIndex;
                });
                break;
            case 'Enter':
                // Select the current item
                if (results[selectedIndex]) {
                    console.log('Selecting item:', results[selectedIndex]);
                    handleSelectSymbol(results[selectedIndex]);
                }
                break;
            case 'Escape':
                // Clear the search
                setQuery('');
                setResults([]);
                break;
            case 'Tab':
                // Close the dropdown but allow normal tab behavior
                setResults([]);
                break;
            default:
                break;
        }
    };

    // Scroll selected item into view without affecting the input position
    useEffect(() => {
        if (resultsRef.current && results.length > 0) {
            const selectedElement = resultsRef.current.querySelector('.selected');
            if (selectedElement) {
                // Get the container and element positions
                const container = resultsRef.current;
                const itemTop = selectedElement.offsetTop;
                const itemHeight = selectedElement.offsetHeight;
                const itemBottom = itemTop + itemHeight;
                const containerTop = container.scrollTop;
                const containerHeight = container.offsetHeight;
                const containerBottom = containerTop + containerHeight;

                // Force scroll when item is not fully visible
                if (itemTop < containerTop) {
                    // Item is above visible area - scroll up to show it
                    container.scrollTop = Math.max(0, itemTop - 5); // Add small padding
                } else if (itemBottom > containerBottom) {
                    // Item is below visible area - scroll down to show it
                    container.scrollTop = itemBottom - containerHeight + 5; // Add small padding
                }

                // Log for debugging
                console.log('Scrolling to item:', {
                    itemTop,
                    itemBottom,
                    containerTop,
                    containerBottom,
                    newScrollTop: container.scrollTop
                });
            }
        }
    }, [selectedIndex, results.length]);

    // Replace icons after component renders
    useEffect(() => {
        replaceIcons();
    }, []);

    const handleSelectSymbol = (symbol) => {
        onSelect(symbol);
        setQuery('');
        setResults([]);
        inputRef.current?.focus();
    };

    // Use a portal to render the dropdown outside the normal DOM flow
    // This prevents layout shifts when the dropdown appears/disappears
    return (
        <div className="symbol-search-container">
            {showHeader && (
                <div className="card__header">
                    <div className="card__title">
                        <FeatherIcon icon={ICONS.star} size={{ width: 16, height: 16 }} />
                        {title}
                    </div>
                </div>
            )}
            
            <div className="symbol-search" ref={containerRef}>
                <div className="search-input-container">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="search-input"
                        autoFocus={autoFocus}
                        autoComplete="off" /* Prevent browser autocomplete from interfering */
                    />
                    <i className="search-icon" data-feather={ICONS.search}></i>
                </div>

                {loading && <div className="symbol-search-loading">Searching...</div>}

                {/* Render the dropdown only when there are results */}
                {results.length > 0 && (
                    <ul ref={resultsRef} className="search-results">
                        {results.map((result, index) => (
                            <li
                                key={result.symbol}
                                className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => handleSelectSymbol(result)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                title={`${result.symbol}${result.name !== result.symbol ? ` - ${result.name}` : ''} - ${result.exchange || 'Unknown'} - ${result.assetType || 'Unknown'}`}
                            >
                                <span className="symbol">{result.symbol}</span>
                                <span className="name">{result.name === result.symbol ? '' : result.name}</span>
                                <span className="exchange">{result.exchange || 'Unknown'}{result.assetType ? ` (${result.assetType})` : ''}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}