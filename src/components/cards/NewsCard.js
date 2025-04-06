// We'll use a simple function to format dates instead of importing date-fns
function formatTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

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
    // Handle both seconds and milliseconds timestamp formats
    const timestamp = this.article.updated > 10000000000
      ? this.article.updated // Already in milliseconds
      : this.article.updated * 1000; // Convert seconds to milliseconds
    time.textContent = formatTimeAgo(new Date(timestamp));
    
    meta.appendChild(source);
    meta.appendChild(document.createTextNode(' • '));
    meta.appendChild(time);
    content.appendChild(meta);
    
    // Add tags if available
    if (this.article.tags && this.article.tags.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'news-card-tags';
      
      // Display up to 3 tags
      const displayTags = this.article.tags.slice(0, 3);
      displayTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'news-card-tag';
        tagElement.textContent = tag;
        tags.appendChild(tagElement);
      });
      
      content.appendChild(tags);
    }
    
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