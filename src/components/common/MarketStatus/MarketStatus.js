import { isMarketOpen, getNextOpenTime } from '../../../utils/marketStatus.js';

export function createMarketStatus(marketId) {
  const isOpen = isMarketOpen(marketId);
  const statusText = isOpen ? 'Market Open' : `Opens ${getNextOpenTime(marketId)}`;
  
  return `
    <div class="market-status">
      <div class="status-indicator ${isOpen ? 'open' : ''}"></div>
      <div class="status-tooltip">${statusText}</div>
    </div>
  `;
}