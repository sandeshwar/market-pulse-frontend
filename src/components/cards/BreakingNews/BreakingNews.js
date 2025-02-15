import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { MarketDataNewsProvider } from '../../../services/MarketDataNewsProvider.js';

const newsProvider = new MarketDataNewsProvider();

function createNewsItem({ headline, source, updated, symbol }) {
  const time = new Date(updated * 1000).toLocaleString();
  return `
    <div class="news-item" onclick="window.open('${source}', '_blank')">
      <div class="news-content">
        <span class="news-symbol">${symbol}</span>
        <div class="news-title">${headline}</div>
        <div class="news-time">${time}</div>
      </div>
    </div>
  `;
}

export function createBreakingNewsCard() {
  const card = createCard({
    title: 'Breaking News',
    icon: ICONS.globe,
    content: `
      <div class="breaking-news">
        <div class="loading">Loading news...</div>
      </div>
    `
  });

  // Since we're using vanilla JS, we need to wait for the element to be in the DOM
  setTimeout(async () => {
    const cardElement = document.querySelector('.breaking-news');
    if (cardElement) {
      await loadNewsContent(cardElement);
    }
  }, 0);

  return card;
}

async function loadNewsContent(newsElement) {
  try {
    const symbols = ['AAPL', 'MSFT', 'GOOGL'];
    const newsPromises = symbols.map(symbol => newsProvider.getStockNews(symbol));
    const newsResults = await Promise.all(newsPromises);
    
    // Flatten and sort news by timestamp
    const allNews = newsResults
      .flatMap(result => result.news.map(item => ({ ...item, symbol: result.symbol })))
      .sort((a, b) => b.updated - a.updated)
      .slice(0, 5);

    newsElement.outerHTML = `
      <div class="breaking-news">
        <div class="news-list">
          ${allNews.map(item => createNewsItem(item)).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load news:', error);
    newsElement.outerHTML = `
      <div class="error">Failed to load news</div>
    `;
  }
}
