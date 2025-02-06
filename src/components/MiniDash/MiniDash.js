import { createButton } from '../common/Button/Button.js';
import { ICONS } from '../../utils/icons.js';

export function createMiniDash() {
  return `
    <div class="mini-dash">
      <div class="mini-dash-header">
        <span class="mini-dash-title">Quick View</span>
        <div class="watchlist-controls">
          ${createButton({
            icon: ICONS.arrowLeft,
            title: 'Previous watchlist'
          })}
          ${createButton({
            icon: ICONS.arrowRight,
            title: 'Next watchlist'
          })}
          ${createButton({
            icon: ICONS.close,
            title: 'Close mini-dash'
          })}
        </div>
      </div>
      <div class="symbol-list">
        <div class="symbol-item">
          <span class="symbol-name">S&P 500</span>
          <span class="symbol-price positive">+0.8%</span>
        </div>
        <div class="symbol-item">
          <span class="symbol-name">AAPL</span>
          <span class="symbol-price negative">-1.2%</span>
        </div>
        <div class="symbol-item">
          <span class="symbol-name">MSFT</span>
          <span class="symbol-price positive">+2.1%</span>
        </div>
      </div>
    </div>
  `;
}