import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { MarketDataNewsProvider } from '../../../services/MarketDataNewsProvider.js';
import { replaceIcons } from '../../../utils/feather.js';
import { createElementFromHTML } from '../../../utils/dom.js';
import { createNewsFilterDropdown } from '../../common/NewsFilterDropdown/NewsFilterDropdown.js';
import { ensureDefaultIndicesWatchlist } from '../../../utils/indicesWatchlistUtils.js';
import { formatTimeAgo } from '../../../utils/dateUtils.js';
import '../../common/NewsFilterDropdown/NewsFilterDropdown.css';

const newsProvider = new MarketDataNewsProvider();

function createNewsItem({ headline, source, updated }) {
  // Format date using the shared formatTimeAgo utility with freshness class
  const date = new Date(updated * 1000);
  const timeInfo = formatTimeAgo(date, true);

  // Handle source URL safely
  let sourceHostname = '';
  try {
    sourceHostname = new URL(source).hostname.replace('www.', '');
  } catch (e) {
    // If source is not a valid URL, use it as is
    sourceHostname = source || 'Unknown';
  }

  // Add the freshness class to the news item as well for browsers that don't support :has()
  const freshnessBorderClass = timeInfo.class.replace('news-time-', 'news-item-');

  // Add a "New" badge for very fresh news (less than 30 minutes old)
  const isVeryFresh = timeInfo.class === 'news-time-fresh';
  const newBadge = isVeryFresh ? '<span class="news-badge">New</span>' : '';

  return `
    <div class="news-item ${freshnessBorderClass}">
      <div class="news-content">
        <div class="news-title">${headline} ${newBadge}</div>
        <div class="news-meta">
          <span class="news-time ${timeInfo.class}"><i data-feather="${ICONS.clock}"></i> ${timeInfo.text}</span>
          <span class="news-source"><i data-feather="${ICONS.link}"></i> (${sourceHostname})</span>
        </div>
      </div>
    </div>
  `;
}

export async function createBreakingNewsCard() {
  let isMounted = true;
  let currentMode = 'trending'; // Default mode
  let allNews = [];

  // Default symbols for stock news
  const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL'];

  // Default categories for filtered news
  const defaultCategories = ['markets', 'economy'];

  // Create initial card with loading state
  const cardElement = createElementFromHTML(createCard({
    title: 'Breaking News',
    icon: ICONS.globe,
    content: `
      <div class="breaking-news">
        <div class="loading">Loading news...</div>
      </div>
    `
  }));

  // Add the filter dropdown to the card header
  const cardHeader = cardElement.querySelector('.card__header');

  // Create a container for the filter dropdown if it doesn't exist
  let actionsContainer = cardElement.querySelector('.card__actions');
  if (!actionsContainer) {
    actionsContainer = document.createElement('div');
    actionsContainer.className = 'card__actions';
    cardHeader.appendChild(actionsContainer);
  }

  // Create and add the news filter dropdown
  const filterDropdown = createNewsFilterDropdown({
    modes: [
      { id: 'trending', label: 'Trending' },
      { id: 'personalized', label: 'For You' },
      { id: 'filtered', label: 'Filtered' }
    ],
    currentMode: currentMode,
    onChange: (mode) => {
      currentMode = mode;
      loadNews(mode);
    }
  });

  // Create refresh button
  const refreshButton = document.createElement('button');
  refreshButton.className = 'news-refresh-button';
  refreshButton.innerHTML = `<i data-feather="${ICONS.refreshCw}"></i>`;
  refreshButton.title = 'Refresh news';
  refreshButton.addEventListener('click', () => {
    refreshButton.classList.add('rotating');
    loadNews(currentMode).then(() => {
      setTimeout(() => {
        refreshButton.classList.remove('rotating');
      }, 1000);
    });
  });

  actionsContainer.appendChild(filterDropdown);
  actionsContainer.appendChild(refreshButton);

  // Function to safely update content
  const updateContent = (content) => {
    if (!isMounted) return false;
    const newsElement = cardElement.querySelector('.breaking-news');
    if (!newsElement) {
      console.error('News element not found');
      return false;
    }

    // Update the content
    newsElement.innerHTML = content;
    return true;
  };

  // Function to load news based on the selected mode
  const loadNews = async (mode) => {
    if (!isMounted) return;

    // Show loading state
    updateContent('<div class="loading">Loading news...</div>');

    try {
      let newsData;

      switch (mode) {
        case 'personalized':
          // Get personalized news (using watchlist and indices watchlist if available, or default symbols)
          const watchlist = window.userPreferences?.watchlist || defaultSymbols;

          // Get user's selected indices from the indices watchlist
          let indicesList = [];
          try {
            const indicesWatchlist = await ensureDefaultIndicesWatchlist();
            if (indicesWatchlist && indicesWatchlist.indices && indicesWatchlist.indices.length > 0) {
              indicesList = indicesWatchlist.indices;
              console.log('Using user preferred indices for news:', indicesList);
            }
          } catch (error) {
            console.warn('Could not load user indices preferences for news:', error);
          }

          // Combine stock symbols and indices for personalized news
          const combinedTickers = [...watchlist, ...indicesList];

          newsData = await newsProvider.getPersonalizedNews({
            tickers: combinedTickers,
            limit: 8
          });
          allNews = newsData.news.map(item => ({ ...item, symbol: item.tags?.[0] || 'NEWS' }));
          break;

        case 'filtered':
          // Get filtered news with default categories
          newsData = await newsProvider.getFilteredNews({
            categories: defaultCategories,
            limit: 8
          });
          allNews = newsData.news.map(item => ({ ...item, symbol: item.tags?.[0] || 'NEWS' }));
          break;

        case 'trending':
        default:
          // Get trending news from default symbols
          const newsPromises = defaultSymbols.map(symbol => newsProvider.getStockNews(symbol));
          const newsResults = await Promise.all(newsPromises);

          // Flatten and sort news by timestamp
          allNews = newsResults
            .flatMap(result => result.news.map(item => ({ ...item, symbol: result.symbol })))
            .sort((a, b) => b.updated - a.updated)
            .slice(0, 8);
          break;
      }

      if (!isMounted) return;

      // Format current time for the last updated timestamp
      const lastUpdated = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date());

      const content = `
        <div class="news-list">
          ${allNews.map(item => createNewsItem(item)).join('')}
          <div class="news-last-updated">Last updated: ${lastUpdated}</div>
        </div>
      `;

      if (updateContent(content)) {
        // Add click handlers after rendering
        cardElement.querySelectorAll('.news-item').forEach(item => {
          const newsIndex = Array.from(item.parentElement.children).indexOf(item);
          const newsData = allNews[newsIndex];
          item.addEventListener('click', () => window.open(newsData.url || newsData.source, '_blank'));
        });

        await replaceIcons();
      }
    } catch (error) {
      console.error('Failed to load news:', error);
      updateContent('<div class="error">Failed to load news</div>');
    }
  };

  // Initial load
  await loadNews(currentMode);

  // Add cleanup method
  cardElement.cleanup = () => {
    isMounted = false;
  };

  return cardElement;
}
