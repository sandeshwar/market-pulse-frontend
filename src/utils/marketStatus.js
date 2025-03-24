import { MARKET_HOURS } from '../constants/marketConstants.js';

export function getMarketId(indexName) {
  if (!indexName) return null;

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
  const marketTimeStr = now.toLocaleTimeString('en-US', {
    timeZone: market.timezone,
    hour12: false
  });

  // Extract hours and minutes for comparison
  const [hours, minutes] = marketTimeStr.split(':');
  const currentTimeFormatted = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;

  return currentTimeFormatted >= market.open && currentTimeFormatted <= market.close;
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