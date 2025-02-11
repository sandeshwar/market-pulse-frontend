/**
 * Default refresh interval for market data (5 seconds)
 */
export const DEFAULT_REFRESH_INTERVAL = 5000;

/**
 * Market data display formats
 */
export const DISPLAY_FORMATS = {
  DECIMAL: 'decimal',
  COMPACT: 'compact'
};

/**
 * Market status constants
 */
export const MARKET_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  PRE_MARKET: 'pre-market',
  AFTER_HOURS: 'after-hours',
  HOLIDAY: 'holiday',
};

/**
 * Loading states for market data
 */
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Market indices configuration
 */
export const MARKET_INDICES = {
  'SPY': 'S&P 500',
  'DIA': 'Dow Jones',
  'QQQ': 'NASDAQ',
  'IWM': 'Russell 2000',
  'VIX': 'VIX',
};

/**
 * Market data constants
 */
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 2000;

/**
 * Market hours configuration
 */
export const MARKET_HOURS = {
  NYSE: {
    name: 'New York Stock Exchange',
    open: '09:30',
    close: '16:00',
    timezone: 'America/New_York',
    weekdays: [1, 2, 3, 4, 5]
  },
  NASDAQ: {
    name: 'NASDAQ',
    open: '09:30',
    close: '16:00',
    timezone: 'America/New_York',
    weekdays: [1, 2, 3, 4, 5]
  },
  DOW: {
    name: 'Dow Jones',
    open: '09:30',
    close: '16:00',
    timezone: 'America/New_York',
    weekdays: [1, 2, 3, 4, 5]
  }
};