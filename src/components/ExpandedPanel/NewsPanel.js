import { NewsCardList } from '../cards/NewsCard.js';
import { MarketDataNewsProvider } from '../../services/MarketDataNewsProvider.js';

/**
 * News Panel Component
 * Displays news in the expanded panel
 */
export class NewsPanel {
  /**
   * Constructor for NewsPanel
   * @param {Object} options - Configuration options
   * @param {string} options.mode - Display mode: 'ticker', 'trending', 'personalized'
   * @param {string} options.ticker - Ticker symbol when mode is 'ticker'
   * @param {Array} options.watchlist - User's watchlist for personalized news
   * @param {string} options.location - User's location for personalized news
   */
  constructor({ 
    mode = 'trending', 
    ticker = null, 
    watchlist = [], 
    location = null 
  } = {}) {
    this.mode = mode;
    this.ticker = ticker;
    this.watchlist = watchlist;
    this.location = location;
    this.newsProvider = new MarketDataNewsProvider();
    this.element = null;
    this.newsCardList = null;
    this.isLoading = false;
  }
  
  /**
   * Renders the news panel
   * @returns {HTMLElement} The rendered news panel element
   */
  async render() {
    const container = document.createElement('div');
    container.className = 'news-panel';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'news-panel-header';
    
    const title = document.createElement('h2');
    title.className = 'news-panel-title';
    
    switch (this.mode) {
      case 'ticker':
        title.textContent = `${this.ticker} News`;
        break;
      case 'personalized':
        title.textContent = 'Your News Feed';
        break;
      case 'trending':
      default:
        title.textContent = 'Trending News';
        break;
    }
    
    header.appendChild(title);
    
    // Create filter options
    const filters = document.createElement('div');
    filters.className = 'news-panel-filters';
    
    // Add mode selector
    const modeSelector = document.createElement('select');
    modeSelector.className = 'news-mode-selector';
    
    const trendingOption = document.createElement('option');
    trendingOption.value = 'trending';
    trendingOption.textContent = 'Trending';
    trendingOption.selected = this.mode === 'trending';
    
    const personalizedOption = document.createElement('option');
    personalizedOption.value = 'personalized';
    personalizedOption.textContent = 'For You';
    personalizedOption.selected = this.mode === 'personalized';
    
    modeSelector.appendChild(trendingOption);
    modeSelector.appendChild(personalizedOption);
    
    if (this.ticker) {
      const tickerOption = document.createElement('option');
      tickerOption.value = 'ticker';
      tickerOption.textContent = this.ticker;
      tickerOption.selected = this.mode === 'ticker';
      modeSelector.appendChild(tickerOption);
    }
    
    modeSelector.addEventListener('change', (e) => {
      this.mode = e.target.value;
      this.refreshNews();
    });
    
    filters.appendChild(modeSelector);
    header.appendChild(filters);
    container.appendChild(header);
    
    // Create content area with loading indicator
    const content = document.createElement('div');
    content.className = 'news-panel-content';
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'news-loading-indicator';
    loadingIndicator.textContent = 'Loading news...';
    content.appendChild(loadingIndicator);
    
    container.appendChild(content);
    
    this.element = container;
    
    // Load news after rendering
    await this.loadNews();
    
    return container;
  }
  
  /**
   * Loads news based on the current mode
   */
  async loadNews() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoading(true);
    
    try {
      let newsData;
      
      switch (this.mode) {
        case 'ticker':
          if (this.ticker) {
            newsData = await this.newsProvider.getStockNews(this.ticker, 10);
          }
          break;
        case 'personalized':
          newsData = await this.newsProvider.getPersonalizedNews({
            tickers: this.watchlist,
            location: this.location,
            limit: 15
          });
          break;
        case 'trending':
        default:
          newsData = await this.newsProvider.getTrendingNews(15);
          break;
      }
      
      this.displayNews(newsData?.news || []);
    } catch (error) {
      console.error('Failed to load news:', error);
      this.displayError('Failed to load news. Please try again later.');
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }
  
  /**
   * Displays the news articles
   * @param {Array} articles - News articles to display
   */
  displayNews(articles) {
    const content = this.element.querySelector('.news-panel-content');
    
    // Clear existing content except loading indicator
    Array.from(content.children).forEach(child => {
      if (!child.classList.contains('news-loading-indicator')) {
        content.removeChild(child);
      }
    });
    
    // Create and render news card list
    if (this.newsCardList) {
      this.newsCardList.update(articles);
    } else {
      this.newsCardList = new NewsCardList(articles, {
        onArticleClick: (article) => {
          window.open(article.url, '_blank');
        },
        emptyMessage: 'No news available at this time.'
      });
      content.appendChild(this.newsCardList.render());
    }
  }
  
  /**
   * Displays an error message
   * @param {string} message - Error message to display
   */
  displayError(message) {
    const content = this.element.querySelector('.news-panel-content');
    
    // Clear existing content except loading indicator
    Array.from(content.children).forEach(child => {
      if (!child.classList.contains('news-loading-indicator')) {
        content.removeChild(child);
      }
    });
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'news-error-message';
    errorMessage.textContent = message;
    
    const retryButton = document.createElement('button');
    retryButton.className = 'news-retry-button';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => this.refreshNews());
    
    errorMessage.appendChild(document.createElement('br'));
    errorMessage.appendChild(retryButton);
    
    content.appendChild(errorMessage);
  }
  
  /**
   * Shows or hides the loading indicator
   * @param {boolean} show - Whether to show the loading indicator
   */
  showLoading(show) {
    const loadingIndicator = this.element.querySelector('.news-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'block' : 'none';
    }
  }
  
  /**
   * Refreshes the news content
   */
  async refreshNews() {
    await this.loadNews();
  }
  
  /**
   * Updates the panel with new options
   * @param {Object} options - New configuration options
   */
  update(options = {}) {
    if (options.mode !== undefined) {
      this.mode = options.mode;
    }
    
    if (options.ticker !== undefined) {
      this.ticker = options.ticker;
    }
    
    if (options.watchlist !== undefined) {
      this.watchlist = options.watchlist;
    }
    
    if (options.location !== undefined) {
      this.location = options.location;
    }
    
    // Update the title based on the new mode
    const title = this.element.querySelector('.news-panel-title');
    if (title) {
      switch (this.mode) {
        case 'ticker':
          title.textContent = `${this.ticker} News`;
          break;
        case 'personalized':
          title.textContent = 'Your News Feed';
          break;
        case 'trending':
        default:
          title.textContent = 'Trending News';
          break;
      }
    }
    
    // Update the mode selector
    const modeSelector = this.element.querySelector('.news-mode-selector');
    if (modeSelector) {
      Array.from(modeSelector.options).forEach(option => {
        option.selected = option.value === this.mode;
      });
    }
    
    this.refreshNews();
  }
}