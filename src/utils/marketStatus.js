const MARKET_HOURS = {
  NYSE: {
    name: 'New York Stock Exchange',
    open: '09:30',
    close: '16:00',
    timezone: 'America/New_York',
    weekdays: [1, 2, 3, 4, 5] // Monday to Friday
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

export function getMarketId(indexName) {
  const normalizedName = indexName.toLowerCase();
  if (normalizedName.includes('s&p')) return 'NYSE';
  if (normalizedName.includes('nasdaq')) return 'NASDAQ';
  if (normalizedName.includes('dow')) return 'DOW';
  return null;
}

export function isMarketOpen(marketId) {
  const market = MARKET_HOURS[marketId];
  if (!market) return false;

  const now = new Date();
  const day = now.getDay();
  
  // Check if it's a weekday
  if (!market.weekdays.includes(day)) return false;
  
  // Convert current time to market timezone
  const marketTime = now.toLocaleTimeString('en-US', { 
    timeZone: market.timezone,
    hour12: false 
  });
  
  return marketTime >= market.open && marketTime <= market.close;
}

export function getNextOpenTime(marketId) {
  const market = MARKET_HOURS[marketId];
  if (!market) return null;

  const now = new Date();
  const day = now.getDay();
  
  // If market is currently open, get next day's opening
  if (isMarketOpen(marketId)) {
    now.setDate(now.getDate() + 1);
  }
  
  // Find next trading day
  while (!market.weekdays.includes(now.getDay())) {
    now.setDate(now.getDate() + 1);
  }
  
  return `${now.toLocaleDateString()} ${market.open} ${market.timezone}`;
}