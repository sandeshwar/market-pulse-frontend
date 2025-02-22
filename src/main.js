// frontend/src/main.js
import { createExpandedPanel } from './components/ExpandedPanel/ExpandedPanel.js';
import { initNavigation, navigationHandlers } from './utils/navigation.js';
import { replaceIcons } from './utils/feather.js';
import { watchlistService } from './services/watchlistService.js';

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

// Watchlist handlers
async function handleEditWatchlist(name) {
  const newName = prompt('Enter new name for watchlist:', name);
  if (newName && newName !== name) {
    try {
      await watchlistService.renameWatchlist(name, newName);
    } catch (error) {
      console.error('Error renaming watchlist:', error);
      alert('Failed to rename watchlist');
    }
  }
}

async function handleDeleteWatchlist(name) {
  if (confirm(`Are you sure you want to delete the watchlist "${name}"?`)) {
    try {
      await watchlistService.deleteWatchlist(name);
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      alert('Failed to delete watchlist');
    }
  }
}

async function handleCreateWatchlist() {
  const name = prompt('Enter watchlist name:');
  if (name) {
    try {
      await watchlistService.createWatchlist(name);
    } catch (error) {
      console.error('Error creating watchlist:', error);
      alert('Failed to create watchlist');
    }
  }
}

async function handleAddSymbol(watchlistName, symbol) {
  try {
    await watchlistService.addSymbol(watchlistName, symbol);
  } catch (error) {
    console.error('Error adding symbol:', error);
    alert('Failed to add symbol to watchlist');
  }
}

async function handleRemoveSymbol(watchlistName, symbol) {
  try {
    await watchlistService.removeSymbol(watchlistName, symbol);
  } catch (error) {
    console.error('Error removing symbol:', error);
    alert('Failed to remove symbol from watchlist');
  }
}

// Event handler map
const buttonHandlers = {
  togglePanel,
  handleTabSwitch: navigationHandlers.handleTabSwitch,
  handleCardOptions: () => {
    console.log('Card options clicked');
  },
  editWatchlist: (event) => {
    const button = event.target.closest('button');
    const name = button.dataset.watchlistName;
    if (name) {
      handleEditWatchlist(name);
    }
  },
  deleteWatchlist: (event) => {
    const button = event.target.closest('button');
    const name = button.dataset.watchlistName;
    if (name) {
      handleDeleteWatchlist(name);
    }
  },
  createWatchlist: () => {
    handleCreateWatchlist();
  },
  addSymbol: (event) => {
    const button = event.target.closest('button');
    const name = button.dataset.watchlistName;
    if (name) {
      const input = button.closest('.list-footer').querySelector('input');
      if (input && input.value) {
        handleAddSymbol(name, input.value);
        input.value = '';
      }
    }
  },
  removeSymbol: (event) => {
    const button = event.target.closest('button');
    const name = button.dataset.watchlistName;
    const symbol = button.dataset.symbol;
    if (name && symbol) {
      handleRemoveSymbol(name, symbol);
    }
  }
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
