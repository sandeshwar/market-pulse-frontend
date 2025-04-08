/**
 * Default refresh interval for market data (15 seconds)
 */
export const DEFAULT_REFRESH_INTERVAL = 15000; 


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
 * Market data constants
 */
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 2000;

/**
 * Market hours configuration
 */
export const MARKET_HOURS = {
  'NYSE': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
  'NASDAQ': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
  'DOW': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
  // Keep the original indices for backward compatibility
  'SPX': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
  'DJI': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
  'IXIC': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
  'NDX': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
  'VIX': {
    'open': '09:30',
    'close': '16:00',
    'weekdays': [1, 2, 3, 4, 5], // Monday to Friday
    'timezone': 'America/New_York'
  },
};