import React, { useState, useEffect, useRef } from 'react';
import { marketDataService } from '../../../services/marketDataService.js';
import './IndicesSearch.css';

/**
 * Reusable Indices Search component
 * @param {Object} props
 * @param {Function} props.onSelect - Callback when index is selected
 * @param {number} props.maxResults - Maximum number of results to show (default: 10)
 * @param {string} props.placeholder - Placeholder text for the input
 * @param {boolean} props.autoFocus - Whether to autofocus the input
 */
export function IndicesSearch({ onSelect, maxResults = 10, placeholder = "Search indices (e.g. SPX, S&P 500)", autoFocus = false }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [allIndices, setAllIndices] = useState([]);
    const [indicesLoaded, setIndicesLoaded] = useState(false);
    const inputRef = useRef(null);
    const resultsRef = useRef(null);
    const containerRef = useRef(null);

    // Load all indices on component mount
    useEffect(() => {
        const loadAllIndices = async () => {
            try {
                setLoading(true);
                const indices = await marketDataService.getAvailableIndices();

                // Transform the indices data to match our expected format
                const formattedIndices = indices.map(index => {
                    // The index.name from the API is actually the symbol (e.g., "SPX")
                    const symbol = index.name;
                    // Get the full name from additionalData
                    const fullName = index.additionalData?.name || symbol;

                    return {
                        symbol: symbol,
                        name: fullName,
                        exchange: index.additionalData?.exchange || '',
                        assetType: 'Index',
                        // Include additional data for display or future use
                        price: index.value,
                        change: index.change,
                        changePercent: index.changePercent,
                        additionalData: index.additionalData
                    };
                });

                // Log the count of indices for debugging
                console.log(`Loaded ${formattedIndices.length} indices from API`);

                setAllIndices(formattedIndices);
                setIndicesLoaded(true);
                console.log('Loaded indices:', formattedIndices);
            } catch (error) {
                console.error('Failed to load indices:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAllIndices();
    }, []);

    // Search for indices when query changes
    useEffect(() => {
        const searchIndices = () => {
            if (query.length < 1 || !indicesLoaded) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                // Filter indices from our loaded indices based on query
                const filteredIndices = allIndices.filter(index =>
                    index.symbol.toLowerCase().includes(query.toLowerCase()) ||
                    index.name.toLowerCase().includes(query.toLowerCase())
                );

                // Log the number of matches for debugging
                console.log(`Found ${filteredIndices.length} indices matching "${query}"`);

                // Use a higher limit to show more results
                setResults(filteredIndices.slice(0, Math.max(maxResults, 20)));
                // Reset selection to first item when results change
                setSelectedIndex(0);
            } catch (error) {
                console.error('Indices search error:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search to avoid excessive processing
        const debounceTimer = setTimeout(searchIndices, 300);
        return () => clearTimeout(debounceTimer);
    }, [query, maxResults, allIndices, indicesLoaded]);

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
                    handleSelectIndex(results[selectedIndex]);
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

    const handleSelectIndex = (index) => {
        onSelect(index);
        setQuery('');
        setResults([]);
        inputRef.current?.focus();
    };

    return (
        <div className="symbol-search" ref={containerRef}>
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={!indicesLoaded ? "Loading indices..." : placeholder}
                className="search-input"
                autoFocus={autoFocus}
                autoComplete="off" /* Prevent browser autocomplete from interfering */
                disabled={!indicesLoaded} /* Disable input while indices are loading */
            />

            {loading && <div className="symbol-search-loading">
                {!indicesLoaded ? "Loading indices..." : "Searching..."}
            </div>}

            {/* Render the dropdown only when there are results */}
            {results.length > 0 && (
                <ul ref={resultsRef} className="search-results">
                    {results.map((result, index) => (
                        <li
                            key={result.symbol}
                            className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleSelectIndex(result)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            title={`${result.symbol} - ${result.name}`}
                        >
                            <span className="symbol">{result.symbol}</span>
                            <span className="name">{result.name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}