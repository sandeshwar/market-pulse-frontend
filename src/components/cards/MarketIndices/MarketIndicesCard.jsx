import { useState, useEffect, useRef } from 'react';
import { Card } from '../../common/Card/Card.jsx';
import { ICONS } from '../../../utils/icons.js';
import { marketDataProvider } from '../../../services/providers/MarketDataAppProvider.js';
import { SortDropdownReact } from '../../common/SortDropdown/SortDropdownReact.jsx';
import { DEFAULT_REFRESH_INTERVAL, MAX_RETRIES, RETRY_DELAY } from '../../../constants/marketConstants.js';
import { getMarketId } from '../../../utils/marketStatus.js';
import { FeatherIcon } from '../../common/FeatherIcon/FeatherIcon.jsx';
import { indicesWatchlistService } from '../../../services/indicesWatchlistService.js';
import { ensureDefaultIndicesWatchlist, DEFAULT_INDICES } from '../../../utils/indicesWatchlistUtils.js';
import Loader from '../../common/Loader/Loader.jsx';
import './MarketIndices.css';

// Helper function to convert currency codes to symbols
function getCurrencySymbol(currencyCode) {
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'RUB': '₽',
    'KRW': '₩',
    'BRL': 'R$',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'Fr',
    'HKD': 'HK$',
    'SGD': 'S$',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'TRY': '₺',
    'MXN': 'Mex$',
    'ZAR': 'R'
  };

  // Return the symbol if found, otherwise return the currency code
  return currencySymbols[currencyCode] || currencyCode;
}

export const MarketIndicesCard = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [flippedIndices, setFlippedIndices] = useState({});
  const [retryCount, setRetryCount] = useState(0);
  const [userIndices, setUserIndices] = useState([]);
  const flipIntervalsRef = useRef([]);

  // Define sort fields
  const sortFields = [
    { id: 'name', label: 'Name' },
    { id: 'value', label: 'Value' },
    { id: 'change', label: 'Change' },
    { id: 'changePercent', label: 'Percent Change' }
  ];

  // Load user's preferred indices
  const loadUserIndices = async () => {
    try {
      const watchlist = await ensureDefaultIndicesWatchlist();
      if (watchlist && watchlist.indices && Array.isArray(watchlist.indices)) {
        // Create a new array to ensure state update
        const indices = [...watchlist.indices];
        setUserIndices(indices);
        console.log('Using user preferred indices:', JSON.stringify(indices));
        
        // Return the loaded indices for chaining
        return indices;
      } else {
        console.warn('Watchlist or indices array is invalid:', watchlist);
        return [];
      }
    } catch (error) {
      console.warn('Could not load user indices preferences:', error);
      // Continue with default indices if we can't get user preferences
      return [];
    }
  };

  // Fetch market indices data
  const fetchIndices = async () => {
    try {
      setLoading(true);
      const allIndices = await marketDataProvider.getMarketIndices();
      
      if (allIndices && Array.isArray(allIndices)) {
        // Log all available indices for debugging
        console.log('All available indices:', allIndices.map(idx => idx.name).join(', '));
        
        // Filter indices based on user preferences if available
        let indicesToShow = [];
        
        // Make a local copy of userIndices to avoid any state update issues
        const currentUserIndices = [...userIndices];
        console.log('Current user indices:', JSON.stringify(currentUserIndices));
        
        if (currentUserIndices.length > 0) {
          // Filter to only show indices that the user has selected
          indicesToShow = allIndices.filter(index => 
            currentUserIndices.includes(index.name)
          );
          
          console.log('Filtered indices based on user preferences:', 
            indicesToShow.map(idx => idx.name).join(', '));
          
          // If no matches found (possibly due to symbol name differences), 
          // we'll fall back to default indices
          if (indicesToShow.length === 0) {
            console.warn('No matching indices found in user preferences, will use default indices');
          }
        }
        
        // If no user preferences or no matches, use our default indices
        if (indicesToShow.length === 0) {
          // Filter available indices to match our default set
          indicesToShow = allIndices.filter(index => 
            DEFAULT_INDICES.includes(index.name)
          );
          
          console.log('Using default indices:', 
            indicesToShow.map(idx => idx.name).join(', '));
          
          // If still no matches (unlikely but possible), show top 5 indices
          if (indicesToShow.length === 0) {
            console.warn('No matching indices found for defaults, showing top 5');
            indicesToShow = allIndices.slice(0, 5);
            console.log('Falling back to top 5 indices:', 
              indicesToShow.map(idx => idx.name).join(', '));
          }
        }
        
        // Log the indices data for debugging
        console.log('Market indices data to display:', 
          indicesToShow.map(idx => `${idx.name}: ${idx.value}`).join(', '));
        
        // Create a new array to ensure state update
        setIndices([...indicesToShow]);
        setError(null);
        setRetryCount(0); // Reset retry count on success
      } else {
        console.error('Invalid market indices data:', allIndices);
        setError('Failed to load market indices');
        handleRetry();
      }
    } catch (error) {
      console.error('Error fetching market indices:', error);
      setError('Failed to load market indices');
      handleRetry();
    } finally {
      setLoading(false);
    }
  };

  // Handle retry logic
  const handleRetry = () => {
    if (retryCount < MAX_RETRIES) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      console.log(`Retrying update (${newRetryCount}/${MAX_RETRIES})...`);
      
      // Schedule retry
      setTimeout(() => {
        fetchIndices();
      }, RETRY_DELAY);
    }
  };

  // Set up automatic flipping animation
  useEffect(() => {
    if (indices.length === 0 || loading) return;

    // Clear any existing flip timeouts
    flipIntervalsRef.current.forEach(interval => clearTimeout(interval));
    flipIntervalsRef.current = [];

    // Set up automatic flipping for each index item with a staggered start
    indices.forEach((index, i) => {
      // Calculate delays based on index for a wave effect
      const startDelay = 2000 + (i * 800); // Initial delay plus stagger
      const flipDuration = 5000; // How long to show each side
      const cycleTime = 10000; // Total time for a complete flip cycle

      // Function to handle the flip cycle
      const flipCycle = () => {
        setFlippedIndices(prev => {
          const newState = { ...prev };
          newState[index.name] = !newState[index.name];
          return newState;
        });

        // Schedule next flip
        const timeoutId = setTimeout(
          flipCycle, 
          flippedIndices[index.name] ? flipDuration : (cycleTime - flipDuration)
        );
        
        flipIntervalsRef.current.push(timeoutId);
      };

      // Start the flip cycle after initial delay
      const initialTimeoutId = setTimeout(flipCycle, startDelay);
      flipIntervalsRef.current.push(initialTimeoutId);
    });

    // Cleanup function
    return () => {
      flipIntervalsRef.current.forEach(interval => clearTimeout(interval));
      flipIntervalsRef.current = [];
    };
  }, [indices, loading]);

  // Handle watchlist updates
  const handleWatchlistUpdate = (updatedWatchlists) => {
    console.log('Indices watchlist updated, refreshing display immediately', 
      JSON.stringify(updatedWatchlists));
    
    // Extract user indices from the updated watchlist
    if (updatedWatchlists && Array.isArray(updatedWatchlists) && updatedWatchlists.length > 0) {
      const watchlist = updatedWatchlists[0];
      if (watchlist && Array.isArray(watchlist.indices)) {
        console.log('Setting user indices to:', JSON.stringify(watchlist.indices));
        setUserIndices([...watchlist.indices]); // Create a new array to ensure state update
      } else {
        console.warn('Watchlist or indices array is invalid:', watchlist);
      }
    } else {
      console.warn('Updated watchlists is not a valid array:', updatedWatchlists);
    }
    
    // Force immediate update
    setTimeout(() => {
      fetchIndices();
    }, 100); // Small delay to ensure state is updated
  };

  // Initial data load
  useEffect(() => {
    console.log('MarketIndicesCard component mounted');
    
    // Load user indices first, then fetch market data
    const initializeData = async () => {
      try {
        // First, load user indices
        await loadUserIndices();
        
        // Then fetch the market data
        await fetchIndices();
        
        console.log('Initial market indices data loaded successfully');
      } catch (error) {
        console.error('Error during initial data load:', error);
      }
    };
    
    // Execute the initialization
    initializeData();
    
    // Add watchlist service listener for updates
    indicesWatchlistService.addListener(handleWatchlistUpdate);
    console.log('Added indices watchlist listener');
    
    // Set up auto-refresh interval
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing market indices data');
      fetchIndices();
    }, DEFAULT_REFRESH_INTERVAL);
    
    // Cleanup interval and listeners on component unmount
    return () => {
      console.log('MarketIndicesCard component unmounting');
      clearInterval(refreshInterval);
      indicesWatchlistService.removeListener(handleWatchlistUpdate);
      // Also clear any flip timeouts
      flipIntervalsRef.current.forEach(interval => clearTimeout(interval));
    };
  }, []);

  // Handle sort change
  const handleSortChange = (field, direction) => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Handle manual flip toggle
  const handleFlipToggle = (indexName) => {
    setFlippedIndices(prev => ({
      ...prev,
      [indexName]: !prev[indexName]
    }));
  };

  // Get sorted indices data
  const getSortedIndices = () => {
    if (!indices || indices.length === 0) return [];

    return [...indices].sort((a, b) => {
      let aValue, bValue;

      // Determine which field to sort by
      switch (sortField) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'value':
          aValue = a.value || 0;
          bValue = b.value || 0;
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
          aValue = a.name || '';
          bValue = b.name || '';
      }

      // Apply sort direction
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  // Render market indices
  const renderIndices = () => {
    if (loading && indices.length === 0) {
      return <Loader size="medium" type="spinner" text="Loading indices..." />;
    }

    if (error) {
      return (
        <div className="error-message">
          <FeatherIcon 
            icon={ICONS.alertTriangle} 
            className="error-icon" 
            size={{ width: 18, height: 18 }}
          />
          {error}
          {retryCount < MAX_RETRIES && (
            <div className="retry-message">Retrying...</div>
          )}
        </div>
      );
    }

    if (!indices || indices.length === 0) {
      return <div className="empty-state">No market indices available</div>;
    }

    const sortedIndices = getSortedIndices();

    return (
      <div className="market-indices">
        {sortedIndices.map((index, i) => {
          const isPositive = index.change >= 0;
          const changeClass = isPositive ? 'positive' : 'negative';
          const marketId = getMarketId(index.name);
          const isFlipped = flippedIndices[index.name] || false;
          
          // Get additional data
          const additionalData = index.additionalData || {};
          const highPrice = additionalData.highPrice ? 
            `H: ${parseFloat(additionalData.highPrice).toFixed(2)} ↑` : '';
          const lowPrice = additionalData.lowPrice ? 
            `L: ${parseFloat(additionalData.lowPrice).toFixed(2)} ↓` : '';
          const currency = additionalData.currency || '';
          
          // Get technical rating if available
          const technicalRating = additionalData.technicalRating || '';
          const ratingClass = technicalRating.toLowerCase().includes('buy') ? 'positive' :
                            technicalRating.toLowerCase().includes('sell') ? 'negative' : '';
          
          return (
            <div 
              key={index.name || i} 
              className={`index-item ${changeClass} ${isFlipped ? 'flipping' : ''}`}
              onClick={() => handleFlipToggle(index.name)}
              data-index={index.name}
            >
              {/* Market Status Indicator */}
              <div className="market-status" data-market-id={marketId}></div>
              
              <div className="index-item-inner">
                {/* Front Face */}
                <div className="index-face index-face-front">
                  <div className="index-name">
                    {index.name || 'Unknown'}
                  </div>
                  <div className="index-value">{(index.value || 0).toFixed(2)}</div>
                  <div className={`index-change ${changeClass}`}>
                    {isPositive ? '+' : ''}{(index.change || 0).toFixed(2)} ({(index.changePercent || 0).toFixed(2)}%)
                  </div>
                </div>
                
                {/* Back Face */}
                <div className="index-face index-face-back">
                  <div className="index-name">
                    {index.name || 'Unknown'}
                  </div>
                  
                  <div className="index-details">
                    {highPrice && <div className="index-high-low high-value">{highPrice}</div>}
                    {lowPrice && <div className="index-high-low low-value">{lowPrice}</div>}
                    {technicalRating && (
                      <div className={`index-rating ${ratingClass}`}>{technicalRating}</div>
                    )}
                  </div>
                  
                  {currency && 
                    <div className="index-currency">{getCurrencySymbol(currency)}</div>
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card 
      title="Market Indices" 
      icon={ICONS.trendingUp}
      actions={
        <SortDropdownReact
          fields={sortFields}
          defaultField={sortField}
          defaultDirection={sortDirection}
          onSort={handleSortChange}
        />
      }
    >
      {renderIndices()}
    </Card>
  );
};