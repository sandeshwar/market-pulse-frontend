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
 * Common market index symbols
 * These are example symbols - actual symbols will come from user preferences
 */
export const MARKET_SYMBOLS = {
  SENSEX: '^BSESN',
  NIFTY: '^NSEI',
  SP500: '^GSPC',
  NASDAQ: '^IXIC',
  DOW: '^DJI',
  FTSE: '^FTSE',
  DAX: '^GDAXI',
  NIKKEI: '^N225'
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