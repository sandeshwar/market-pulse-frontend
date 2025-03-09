/**
 * Default refresh interval for market data (5 seconds)
 */
export const DEFAULT_REFRESH_INTERVAL = 600000; // updated this for testing. TODO:: reset this to 5000


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
  'SPX': 'S&P 500',
  'DJI': 'Dow Jones',
  'IXIC': 'NASDAQ',
  'NDX': 'NASDAQ 100',
  'VIX': 'VIX',
};

/**
 * Market data constants
 */
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 2000;

/**
 * Market hours configuration (in UTC)
 */
export const MARKET_HOURS = {
  'SPX': {
    'open': 930,
    'close': 1600,
  },
  'DJI': {
    'open': 930,
    'close': 1600,
  },
  'IXIC': {
    'open': 930,
    'close': 1600,
  },
  'NDX': {
    'open': 930,
    'close': 1600,
  },
  'VIX': {
    'open': 930,
    'close': 1600,
  },
};