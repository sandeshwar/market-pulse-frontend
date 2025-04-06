import { NewsCardList } from '../cards/NewsCard.js';
import { MarketDataNewsProvider } from '../../services/MarketDataNewsProvider.js';
import { createNewsFilterDropdown } from '../common/NewsFilterDropdown/NewsFilterDropdown.js';
import { ensureDefaultIndicesWatchlist } from '../../utils/indicesWatchlistUtils.js';
import '../../styles/news.css';
import '../common/NewsFilterDropdown/NewsFilterDropdown.css';

/**
 * News Panel Component
 * Displays news in the expanded panel
 */
export class NewsPanel {
  /**
   * Constructor for NewsPanel
   * @param {Object} options - Configuration options
   * @param {string} options.mode - Display mode: 'ticker', 'trending', 'personalized', 'filtered'
   * @param {string} options.ticker - Ticker symbol when mode is 'ticker'
   * @param {Array} options.watchlist - User's watchlist for personalized news
   * @param {string} options.location - User's location for personalized news
   * @param {Array} options.tags - Tags for filtered news
   * @param {Array} options.categories - Categories for filtered news
   */
  constructor({
    mode = 'trending',
    ticker = null,
    watchlist = [],
    location = null,
    tags = [],
    categories = []
  } = {}) {
    this.mode = mode;
    this.ticker = ticker;
    this.watchlist = watchlist;
    this.location = location;
    this.tags = tags;
    this.categories = categories;
    this.newsProvider = new MarketDataNewsProvider();
    this.element = null;
    this.newsCardList = null;
    this.isLoading = false;

    // Common categories for financial news
    this.availableCategories = [
      'markets', 'stocks', 'economy', 'business',
      'technology', 'finance', 'investing', 'crypto'
    ];

    // Common tags for financial news
    this.availableTags = [
      'earnings', 'ipo', 'merger', 'acquisition',
      'dividend', 'fed', 'interest-rates', 'inflation'
    ];
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
      case 'filtered':
        title.textContent = 'Filtered News';
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

    // Create news filter dropdown
    const filterDropdown = createNewsFilterDropdown({
      modes: [
        { id: 'trending', label: 'Trending' },
        { id: 'personalized', label: 'For You' },
        { id: 'filtered', label: 'Filtered' }
      ],
      currentMode: this.mode,
      ticker: this.ticker,
      onChange: (mode) => {
        this.mode = mode;
        this.updateFilterVisibility();
        this.refreshNews();
      }
    });

    // Store reference to the dropdown for later updates
    this.filterDropdown = filterDropdown;

    filters.appendChild(filterDropdown);
    header.appendChild(filters);
    container.appendChild(header);

    // Create filter controls container
    const filterControls = document.createElement('div');
    filterControls.className = 'news-filter-controls';
    filterControls.style.display = this.mode === 'filtered' ? 'flex' : 'none';

    // Create category filter
    const categoryFilter = this.createFilterSelector(
      'Categories',
      this.availableCategories,
      this.categories,
      (selected) => {
        this.categories = selected;
        this.refreshNews();
      }
    );

    // Create tag filter
    const tagFilter = this.createFilterSelector(
      'Tags',
      this.availableTags,
      this.tags,
      (selected) => {
        this.tags = selected;
        this.refreshNews();
      }
    );

    filterControls.appendChild(categoryFilter);
    filterControls.appendChild(tagFilter);
    container.appendChild(filterControls);

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
   * Creates a filter selector component
   * @param {string} label - Label for the filter
   * @param {Array} options - Available options
   * @param {Array} selectedValues - Initially selected values
   * @param {Function} onChange - Callback when selection changes
   * @returns {HTMLElement} The filter selector element
   */
  createFilterSelector(label, options, selectedValues, onChange) {
    const container = document.createElement('div');
    container.className = 'news-filter-selector';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'news-filter-label';
    container.appendChild(labelElement);

    const selectElement = document.createElement('select');
    selectElement.className = 'news-filter-select';
    selectElement.multiple = true;

    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
      optionElement.selected = selectedValues.includes(option);
      selectElement.appendChild(optionElement);
    });

    selectElement.addEventListener('change', () => {
      const selected = Array.from(selectElement.selectedOptions).map(option => option.value);
      onChange(selected);
    });

    container.appendChild(selectElement);

    return container;
  }

  /**
   * Updates the visibility of filter controls based on the current mode
   */
  updateFilterVisibility() {
    const filterControls = this.element.querySelector('.news-filter-controls');
    if (filterControls) {
      filterControls.style.display = this.mode === 'filtered' ? 'flex' : 'none';
    }

    // Update the title based on the mode
    const title = this.element.querySelector('.news-panel-title');
    if (title) {
      switch (this.mode) {
        case 'ticker':
          title.textContent = `${this.ticker} News`;
          break;
        case 'personalized':
          title.textContent = 'Your News Feed';
          break;
        case 'filtered':
          title.textContent = 'Filtered News';
          break;
        case 'trending':
        default:
          title.textContent = 'Trending News';
          break;
      }
    }
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
          const combinedTickers = [...this.watchlist, ...indicesList];

          newsData = await this.newsProvider.getPersonalizedNews({
            tickers: combinedTickers,
            location: this.location,
            limit: 15
          });
          break;
        case 'filtered':
          newsData = await this.newsProvider.getFilteredNews({
            tags: this.tags,
            categories: this.categories,
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

    if (options.tags !== undefined) {
      this.tags = options.tags;
    }

    if (options.categories !== undefined) {
      this.categories = options.categories;
    }

    // Update filter visibility and title
    if (this.element) {
      this.updateFilterVisibility();

      // Update the mode selector
      if (this.filterDropdown) {
        this.filterDropdown.setMode(this.mode);
      }

      // Update filter selections
      const categorySelect = this.element.querySelector('.news-filter-select:first-of-type');
      if (categorySelect) {
        Array.from(categorySelect.options).forEach(option => {
          option.selected = this.categories.includes(option.value);
        });
      }

      const tagSelect = this.element.querySelector('.news-filter-select:last-of-type');
      if (tagSelect) {
        Array.from(tagSelect.options).forEach(option => {
          option.selected = this.tags.includes(option.value);
        });
      }
    }

    this.refreshNews();
  }
}