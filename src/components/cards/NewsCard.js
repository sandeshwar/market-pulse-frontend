import { formatTimeAgo } from '../../utils/dateUtils.js';

/**
 * News Card Component
 * Displays a single news article in a card format
 */
export class NewsCard {
  /**
   * Constructor for NewsCard
   * @param {Object} article - The news article to display
   * @param {Function} onClick - Optional callback for when the card is clicked
   */
  constructor(article, onClick = null) {
    this.article = article;
    this.onClick = onClick;
    this.element = null;
  }

  /**
   * Renders the news card
   * @returns {HTMLElement} The rendered news card element
   */
  render() {
    const card = document.createElement('div');
    card.className = 'news-card';
    
    // Create card content
    const content = document.createElement('div');
    content.className = 'news-card-content';
    
    // Add headline
    const headline = document.createElement('h3');
    headline.className = 'news-card-headline';
    headline.textContent = this.article.headline;
    content.appendChild(headline);
    
    // Add description if available
    if (this.article.description) {
      const description = document.createElement('p');
      description.className = 'news-card-description';
      description.textContent = this.article.description.length > 120 
        ? `${this.article.description.substring(0, 120)}...` 
        : this.article.description;
      content.appendChild(description);
    }
    
    // Add source and time
    const meta = document.createElement('div');
    meta.className = 'news-card-meta';

    const source = document.createElement('span');
    source.className = 'news-card-source';

    // Extract domain from URL if source is a URL
    let sourceText = this.article.source;
    try {
      if (this.article.source && this.article.source.startsWith('http')) {
        const url = new URL(this.article.source);
        sourceText = url.hostname.replace('www.', '');
      }
    } catch (e) {
      // If parsing fails, use the source as is
    }
    source.textContent = sourceText;

    const time = document.createElement('span');
    time.className = 'news-card-time';

    // Handle timestamp conversion more robustly
    let timestamp;
    if (typeof this.article.updated === 'number') {
      // Handle both seconds and milliseconds timestamp formats
      timestamp = this.article.updated > 10000000000
        ? this.article.updated // Already in milliseconds
        : this.article.updated * 1000; // Convert seconds to milliseconds
    } else if (typeof this.article.updated === 'string') {
      // Handle ISO date strings
      timestamp = new Date(this.article.updated).getTime();
    } else {
      // Fallback to current time if updated is missing or invalid
      timestamp = Date.now();
      console.warn('Invalid timestamp format in article:', this.article.headline);
    }

    // Format the date with freshness indicator
    const timeInfo = formatTimeAgo(new Date(timestamp), true);
    time.textContent = timeInfo.text;
    time.classList.add(timeInfo.class);
    
    meta.appendChild(source);
    meta.appendChild(document.createTextNode(' • '));
    meta.appendChild(time);
    content.appendChild(meta);
    
    // Tags removed to reduce clutter
    
    // Add image if available
    if (this.article.imageUrl) {
      const imageContainer = document.createElement('div');
      imageContainer.className = 'news-card-image-container';
      
      const image = document.createElement('img');
      image.className = 'news-card-image';
      image.src = this.article.imageUrl;
      image.alt = this.article.headline;
      image.onerror = () => {
        imageContainer.style.display = 'none';
      };
      
      imageContainer.appendChild(image);
      card.appendChild(imageContainer);
    }
    
    card.appendChild(content);
    
    // Make the entire card clickable
    card.addEventListener('click', () => {
      if (this.onClick) {
        this.onClick(this.article);
      } else {
        // Open the article URL in a new tab
        // Use url if available, otherwise try source if it's a URL
        const linkUrl = this.article.url ||
          (this.article.source && this.article.source.startsWith('http') ? this.article.source : null);

        if (linkUrl) {
          window.open(linkUrl, '_blank');
        }
      }
    });
    
    this.element = card;
    return card;
  }
}

/**
 * News Card List Component
 * Displays a list of news articles
 */
export class NewsCardList {
  /**
   * Constructor for NewsCardList
   * @param {Array} articles - Array of news articles
   * @param {Object} options - Configuration options
   * @param {Function} options.onArticleClick - Callback for when an article is clicked
   * @param {string} options.emptyMessage - Message to display when there are no articles
   */
  constructor(articles, { onArticleClick = null, emptyMessage = 'No news available' } = {}) {
    this.articles = articles;
    this.onArticleClick = onArticleClick;
    this.emptyMessage = emptyMessage;
    this.element = null;
  }
  
  /**
   * Renders the news card list
   * @returns {HTMLElement} The rendered news card list element
   */
  render() {
    const container = document.createElement('div');
    container.className = 'news-card-list';
    
    if (!this.articles || this.articles.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'news-empty-message';
      emptyMessage.textContent = this.emptyMessage;
      container.appendChild(emptyMessage);
    } else {
      this.articles.forEach(article => {
        const card = new NewsCard(article, this.onArticleClick).render();
        container.appendChild(card);
      });
    }
    
    this.element = container;
    return container;
  }
  
  /**
   * Updates the news card list with new articles
   * @param {Array} articles - New array of news articles
   */
  update(articles) {
    this.articles = articles;
    
    if (this.element) {
      // Clear existing content
      while (this.element.firstChild) {
        this.element.removeChild(this.element.firstChild);
      }
      
      // Add new content
      if (!this.articles || this.articles.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'news-empty-message';
        emptyMessage.textContent = this.emptyMessage;
        this.element.appendChild(emptyMessage);
      } else {
        this.articles.forEach(article => {
          const card = new NewsCard(article, this.onArticleClick).render();
          this.element.appendChild(card);
        });
      }
    }
  }
}