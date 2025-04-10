import { createTabNavigation } from './TabNavigation/TabNavigation.js';
import { createMarketIndicesCard } from '../cards/MarketIndices/MarketIndicesWithSortDropdown.js';
// import { createWatchlistCard } from '../cards/Watchlist/Watchlist.jsx';
// Import the React wrapper for future use
import { createWatchlistCardReact } from '../cards/Watchlist/WatchlistReactWrapper.jsx';
import { createBreakingNewsCard } from '../cards/BreakingNews/BreakingNews.js';
import { createSettingsPage } from './Settings/SettingsPage.jsx';
import { replaceIcons } from '../../utils/feather.js';


// Import the branding component
import { createBranding } from '../common/Branding/Branding.js';

export async function createExpandedPanel() {
  // Create components that need cleanup
  const marketIndicesCard = await createMarketIndicesCard();
  const watchlistCard = await createWatchlistCardReact({ title: 'My Watchlist' });
  const newsCard = await createBreakingNewsCard();
  const settingsPage = await createSettingsPage();
  
  // Store cleanup functions
  const cleanupFunctions = new Set([
    marketIndicesCard.cleanup,
    watchlistCard.cleanup,
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
  // Don't clone the marketIndicesCard as it loses event listeners and timeouts
  homeTab.appendChild(marketIndicesCard);
  homeTab.appendChild(watchlistCard);
  panelContent.appendChild(homeTab);
  
  // Watchlists tab
  const watchlistsTab = document.createElement('div');
  watchlistsTab.className = 'tab-content';
  watchlistsTab.dataset.tab = 'watchlists';
  watchlistsTab.style.display = 'none';
  // watchlistsTab.appendChild(allWatchlistsCard);
  panelContent.appendChild(watchlistsTab);
  
  // Markets tab
  const marketsTab = document.createElement('div');
  marketsTab.className = 'tab-content';
  marketsTab.dataset.tab = 'markets';
  marketsTab.style.display = 'none';
  // Create a new instance of marketIndicesCard for the Markets tab
  createMarketIndicesCard().then(newMarketIndicesCard => {
    marketsTab.appendChild(newMarketIndicesCard);
    // Add the cleanup function to our set
    cleanupFunctions.add(newMarketIndicesCard.cleanup);
  });
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

  // Create and add branding element
  const branding = createBranding();
  panel.appendChild(branding);

  // Initialize icons after all DOM elements are added
  await replaceIcons();

  return panel;
}