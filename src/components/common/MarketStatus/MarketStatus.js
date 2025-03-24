import { isMarketOpen, getNextOpenTime } from '../../../utils/marketStatus.js';

export function createMarketStatus(marketId) {
  // Handle null marketId
  if (!marketId) {
    return `
      <div class="market-status">
        <div class="status-indicator"></div>
        <div class="status-tooltip">Market status unavailable</div>
      </div>
    `;
  }

  const isOpen = isMarketOpen(marketId);
  const nextOpenTime = getNextOpenTime(marketId);
  const statusText = isOpen ? 'Market Open' : nextOpenTime ? `Opens ${nextOpenTime}` : 'Market Closed';

  return `
    <div class="market-status">
      <div class="status-indicator ${isOpen ? 'open' : ''}"></div>
      <div class="status-tooltip">${statusText}</div>
    </div>
  `;
}