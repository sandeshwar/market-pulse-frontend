import { useState, useEffect, useRef } from 'react';
import { Card } from '../../common/Card/Card.jsx';
import { ICONS } from '../../../utils/icons.js';
import { MarketDataNewsProvider } from '../../../services/MarketDataNewsProvider.js';
import { DEFAULT_REFRESH_INTERVAL } from '../../../constants/marketConstants.js';
import { formatTimeAgo } from '../../../utils/dateUtils.js';
import { NewsFilterDropdownReact } from '../../common/NewsFilterDropdown/NewsFilterDropdownReact.jsx';
import { FeatherIcon } from '../../common/FeatherIcon/FeatherIcon.jsx';
import Loader from '../../common/Loader/Loader.jsx';
import './BreakingNews.css';

// Default symbols for trending news
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL'];

// Default categories for filtered news
const DEFAULT_CATEGORIES = ['markets', 'economy'];

// Create news provider instance
const newsProvider = new MarketDataNewsProvider();

export const BreakingNewsCard = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentMode, setCurrentMode] = useState('trending');
  const filterDropdownRef = useRef(null);

  // Fetch news data
  const fetchNews = async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);
      
      let newsData = [];
      
      // Use the appropriate method based on the current mode
      switch (currentMode) {
        case 'personalized':
          // Get personalized news (using default symbols for now)
          // In a real implementation, we would get the user's watchlist
          const result = await newsProvider.getPersonalizedNews({
            tickers: DEFAULT_SYMBOLS,
            limit: 8
          });
          
          if (result && result.news) {
            newsData = result.news;
          }
          break;
          
        case 'filtered':
          // Get filtered news with default categories
          const filteredResult = await newsProvider.getFilteredNews({
            categories: DEFAULT_CATEGORIES,
            limit: 8
          });
          
          if (filteredResult && filteredResult.news) {
            newsData = filteredResult.news;
          }
          break;
          
        case 'trending':
        default:
          // Get trending news from default symbols
          const newsPromises = DEFAULT_SYMBOLS.map(symbol => 
            newsProvider.getStockNews(symbol)
          );
          
          const newsResults = await Promise.all(newsPromises);
          
          // Flatten and sort news by timestamp
          newsData = newsResults
            .flatMap(result => {
              if (result && result.news) {
                return result.news.map(item => ({
                  ...item,
                  symbol: result.symbol
                }));
              }
              return [];
            })
            .sort((a, b) => b.updated - a.updated)
            .slice(0, 8);
          break;
      }
      
      if (newsData && Array.isArray(newsData)) {
        setNews(newsData);
        setError(null);
        setLastUpdated(new Date());
      } else {
        console.error('Invalid news data:', newsData);
        setError('Failed to load news');
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('Failed to load news');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    if (!isRefreshing) {
      fetchNews();
    }
  };
  
  // Handle news filter change
  const handleFilterChange = (mode) => {
    setCurrentMode(mode);
  };

  // Initial data load
  useEffect(() => {
    fetchNews();
    
    // Set up auto-refresh interval
    const refreshInterval = setInterval(() => {
      fetchNews();
    }, DEFAULT_REFRESH_INTERVAL);
    
    // Cleanup interval on component unmount
    return () => clearInterval(refreshInterval);
  }, [currentMode]);
  
  // No need to initialize Feather icons anymore since we're using the FeatherIcon component

  // Handle news item click
  const handleNewsClick = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Create news item with proper formatting
  const createNewsItem = (item, index) => {
    // Format date using the shared formatTimeAgo utility with freshness class
    const date = new Date(item.updated * 1000);
    const timeInfo = formatTimeAgo(date, true);

    // Handle source URL safely
    let sourceHostname = '';
    try {
      sourceHostname = new URL(item.source).hostname.replace('www.', '');
    } catch (e) {
      // If source is not a valid URL, use it as is
      sourceHostname = item.source || 'Unknown';
    }

    // Add the freshness class to the news item as well for browsers that don't support :has()
    const freshnessBorderClass = timeInfo.class ? timeInfo.class.replace('news-time-', 'news-item-') : '';

    // Add a "New" badge for very fresh news (less than 30 minutes old)
    const isVeryFresh = timeInfo.class === 'news-time-fresh';
    const newBadge = isVeryFresh ? <span className="news-badge">New</span> : null;

    return (
      <div 
        key={item.id || index} 
        className={`news-item ${freshnessBorderClass}`}
        onClick={() => handleNewsClick(item.url)}
      >
        <div className="news-content">
          <div className="news-title">
            {item.headline} {newBadge}
          </div>
          <div className="news-meta">
            <span className={`news-time ${timeInfo.class || ''}`}>
              <FeatherIcon icon={ICONS.clock} size={{ width: 14, height: 14 }} /> {timeInfo.text}
            </span>
            <span className="news-source">
              <FeatherIcon icon={ICONS.link} size={{ width: 14, height: 14 }} /> ({sourceHostname})
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Render news items
  const renderNews = () => {
    if (loading && news.length === 0) {
      return <Loader size="large" type="dots" />;
    }

    if (error) {
      return <div className="error">{error}</div>;
    }

    if (!news || news.length === 0) {
      return <div className="empty-state">No news available</div>;
    }

    // Format current time for the last updated timestamp
    const lastUpdatedText = lastUpdated ? formatTimeAgo(lastUpdated) : '';

    return (
      <div className="news-list">
        {news.map((item, index) => createNewsItem(item, index))}
        <div className="news-last-updated">Last updated: {lastUpdatedText}</div>
      </div>
    );
  };

  // Define custom actions for the card
  const cardActions = (
    <div className="card__actions">
      <NewsFilterDropdownReact
        ref={filterDropdownRef}
        modes={[
          { id: 'trending', label: 'Trending' },
          { id: 'personalized', label: 'For You' },
          { id: 'filtered', label: 'Filtered' }
        ]}
        currentMode={currentMode}
        onChange={handleFilterChange}
      />
      <button 
        className="news-refresh-button" 
        onClick={handleRefresh}
        disabled={isRefreshing}
        title="Refresh news"
      >
        {isRefreshing ? (
          <Loader size="small" type="spinner" />
        ) : (
          <FeatherIcon icon={ICONS.refreshCw} />
        )}
      </button>
    </div>
  );

  return (
    <Card 
      title="Breaking News" 
      icon={ICONS.globe}
      actions={cardActions}
    >
      <div className="breaking-news">
        {renderNews()}
      </div>
    </Card>
  );
};