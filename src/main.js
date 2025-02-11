// frontend/src/main.js
import { createExpandedPanel } from './components/ExpandedPanel/ExpandedPanel.js';
import { initNavigation, navigationHandlers } from './utils/navigation.js';
import { replaceIcons } from './utils/feather.js';

// Initial state
let isPanelExpanded = false;
let currentPanel = null;

function cleanupCurrentPanel() {
  if (currentPanel?.cleanup) {
    currentPanel.cleanup();
    currentPanel = null;
  }
}

function togglePanel() {
  isPanelExpanded = !isPanelExpanded;
  updatePanelVisibility();
}

function updatePanelVisibility() {
  const expandedPanel = document.querySelector('.side-panel');

  if (isPanelExpanded) {
    expandedPanel.style.width = '420px';
    expandedPanel.style.height = '100%';
  } else {
    expandedPanel.style.width = '0';
    expandedPanel.style.height = '0';
  }
}

// Event handler map
const buttonHandlers = {
  togglePanel,
  handleCardOptions: () => {
    console.log('Card options clicked');
  },
  editWatchlist: () => {
    console.log('Edit watchlist');
  },
  deleteWatchlist: () => {
    console.log('Delete watchlist');
  },
  handleTabSwitch: navigationHandlers.handleTabSwitch
};

function setupButtonEventListeners() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) {
      const action = button.dataset.action;
      const handler = buttonHandlers[action];
      if (typeof handler === 'function') {
        handler(event); // Pass the event to the handler
      } else {
        console.warn(`No handler found for action "${action}"`);
      }
    }
  });
}

// Initialize side panel behavior
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

// Initialize the application
async function initializeApp() {
  setupButtonEventListeners();
  
  const wireframeContainer = document.createElement('div');
  wireframeContainer.className = 'wireframe-container';

  const sidePanelContainer = document.createElement('div');
  sidePanelContainer.className = 'side-panel-container';

  try {
    // Create and initialize the panel
    const panel = await createExpandedPanel();
    cleanupCurrentPanel(); // Cleanup any existing panel
    currentPanel = panel;
    
    sidePanelContainer.appendChild(panel);
    wireframeContainer.appendChild(sidePanelContainer);
    document.body.appendChild(wireframeContainer);

    // Initialize navigation
    initNavigation();

    // Initialize Feather icons
    await replaceIcons();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    sidePanelContainer.innerHTML = `
      <div class="error-state">
        <i data-feather="alert-triangle"></i>
        <p>Failed to load application. Please try again later.</p>
      </div>
    `;
    wireframeContainer.appendChild(sidePanelContainer);
    document.body.appendChild(wireframeContainer);
  }
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Cleanup on page unload
window.addEventListener('unload', cleanupCurrentPanel);
