import { createTabNavigation } from './TabNavigation/TabNavigation.js';
import { createMarketIndicesCard } from '../cards/MarketIndices/MarketIndices.js';
import { createWatchlistCard } from '../cards/Watchlist/Watchlist.jsx';
import { createBreakingNewsCard } from '../cards/BreakingNews/BreakingNews.js';
import { createSettingsPage } from './Settings/SettingsPage.jsx';
import { replaceIcons } from '../../utils/feather.js';

export async function createExpandedPanel() {
  // Create components that need cleanup
  const marketIndicesCard = await createMarketIndicesCard();
  const watchlistCard = await createWatchlistCard({ title: 'My Watchlist' });
  const allWatchlistsCard = await createWatchlistCard({ title: 'All Watchlists' });
  const newsCard = await createBreakingNewsCard();
  const settingsPage = await createSettingsPage();
  
  // Store cleanup functions
  const cleanupFunctions = new Set([
    marketIndicesCard.cleanup,
    watchlistCard.cleanup,
    allWatchlistsCard.cleanup,
    newsCard.cleanup
  ]);
  
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

  // Add navigation and initialize icons
  panel.appendChild(createTabNavigation());
  
  const panelContent = document.createElement('div');
  panelContent.className = 'panel-content';
  
  // Home tab
  const homeTab = document.createElement('div');
  homeTab.className = 'tab-content';
  homeTab.dataset.tab = 'home';
  homeTab.appendChild(marketIndicesCard.cloneNode(true));
  homeTab.appendChild(watchlistCard);
  panelContent.appendChild(homeTab);
  
  // Watchlists tab
  const watchlistsTab = document.createElement('div');
  watchlistsTab.className = 'tab-content';
  watchlistsTab.dataset.tab = 'watchlists';
  watchlistsTab.style.display = 'none';
  watchlistsTab.appendChild(allWatchlistsCard);
  panelContent.appendChild(watchlistsTab);
  
  // Markets tab
  const marketsTab = document.createElement('div');
  marketsTab.className = 'tab-content';
  marketsTab.dataset.tab = 'markets';
  marketsTab.style.display = 'none';
  marketsTab.appendChild(marketIndicesCard);
  panelContent.appendChild(marketsTab);
  
  // News tab
  const newsTab = document.createElement('div');
  newsTab.className = 'tab-content';
  newsTab.dataset.tab = 'news';
  newsTab.style.display = 'none';
  newsTab.appendChild(newsCard);
  panelContent.appendChild(newsTab);
  
  // Settings tab
  const settingsTab = document.createElement('div');
  settingsTab.className = 'tab-content';
  settingsTab.dataset.tab = 'settings';
  settingsTab.style.display = 'none';
  settingsTab.appendChild(settingsPage);
  panelContent.appendChild(settingsTab);
  
  panel.appendChild(panelContent);

  // Initialize icons after all DOM elements are added
  await replaceIcons();

  return panel;
}