import { createTabNavigation } from './TabNavigation/TabNavigation.js';
import { createMarketIndicesCard } from '../cards/MarketIndices/MarketIndices.js';
import { createWatchlistCard } from '../cards/Watchlist/Watchlist.js';
import { createBreakingNewsCard } from '../cards/BreakingNews/BreakingNews.js';
import { createSettingsPage } from './Settings/SettingsPage.js';

export async function createExpandedPanel() {
  // Create components that need cleanup
  const marketIndicesCard = await createMarketIndicesCard();
  
  // Store cleanup functions
  const cleanupFunctions = new Set([marketIndicesCard.cleanup]);
  
  // Create the panel element
  const panel = document.createElement('div');
  panel.className = 'side-panel';
  
  // Add cleanup method to panel
  panel.cleanup = () => {
    cleanupFunctions.forEach(cleanup => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    });
    cleanupFunctions.clear();
  };

  // Set panel content
  panel.innerHTML = `
    ${createTabNavigation()}
    <div class="panel-content">
      <div class="tab-content" data-tab="home">
        ${marketIndicesCard.outerHTML}
        ${createWatchlistCard({ title: 'My Watchlist' })}
      </div>
      <div class="tab-content" data-tab="watchlists" style="display: none;">
        ${createWatchlistCard({ title: 'All Watchlists' })}
      </div>
      <div class="tab-content" data-tab="markets" style="display: none;">
        ${marketIndicesCard.outerHTML}
      </div>
      <div class="tab-content" data-tab="news" style="display: none;">
        ${createBreakingNewsCard()}
      </div>
      <div class="tab-content" data-tab="settings" style="display: none;">
        ${createSettingsPage()}
      </div>
    </div>
  `;

  return panel;
}