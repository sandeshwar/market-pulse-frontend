/**
 * Format dates as relative time or absolute date if older
 * @param {Date} date - The date to format
 * @param {boolean} includeClass - Whether to include a CSS class for styling
 * @returns {Object} - Formatted date information with text and freshness class
 */
export function formatTimeAgo(date, includeClass = false) {
  // Validate the date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('Invalid date provided to formatTimeAgo:', date);
    return includeClass
      ? { text: 'unknown date', class: 'news-time-unknown' }
      : 'unknown date';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  // Handle future dates (possible timestamp errors)
  if (diffInSeconds < 0) {
    // If date appears to be in the future, format it as absolute date
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    }).format(date);

    return includeClass
      ? { text: formattedDate, class: 'news-time-old' }
      : formattedDate;
  }

  // Very fresh news (less than 15 minutes)
  if (diffInSeconds < 900) {
    const text = diffInSeconds < 60 ? 'just now' : `${Math.floor(diffInSeconds / 60)} minutes ago`;
    return includeClass
      ? { text, class: 'news-time-fresh' }
      : text;
  }

  // Recent news (less than 1 hour)
  if (diffInSeconds < 3600) {
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const text = `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    return includeClass
      ? { text, class: 'news-time-recent' }
      : text;
  }

  // Today's news (less than 24 hours)
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    const text = `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    return includeClass
      ? { text, class: 'news-time-today' }
      : text;
  }

  // This week's news (less than 7 days)
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    const text = `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    return includeClass
      ? { text, class: 'news-time-week' }
      : text;
  }

  // Older news
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  }).format(date);

  return includeClass
    ? { text: formattedDate, class: 'news-time-old' }
    : formattedDate;
}

