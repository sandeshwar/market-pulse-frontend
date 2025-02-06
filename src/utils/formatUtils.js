import { DISPLAY_FORMATS } from '../constants/marketConstants.js';

/**
 * Formats a number according to user's locale and preferences
 * @param {number} number - The number to format
 * @param {Object} options - Formatting options
 * @param {string} options.format - Format type ('decimal' or 'compact')
 * @param {string} options.locale - User's locale
 * @returns {string} Formatted number
 */
export function formatNumber(number, options = {}) {
  const { format = DISPLAY_FORMATS.DECIMAL, locale = 'en' } = options;
  
  if (typeof number !== 'number' || isNaN(number)) {
    return '---';
  }

  try {
    if (format === DISPLAY_FORMATS.COMPACT) {
      return new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 2
      }).format(number);
    }

    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(number);
  } catch (error) {
    console.error('Error formatting number:', error);
    return number.toString();
  }
}

/**
 * Formats percentage values
 * @param {number} value - The percentage value
 * @param {string} locale - User's locale
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, locale = 'en') {
  if (typeof value !== 'number' || isNaN(value)) {
    return '---';
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero'
    }).format(value / 100);
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return `${value}%`;
  }
}