import feather from 'feather-icons';

// Track current active tab
let currentTab = 'home';

// Handle tab switching
export function switchTab(tabId) {
  // Update active tab state
  currentTab = tabId;
  
  // Update tab UI
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  
  // Update content visibility
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = content.dataset.tab === tabId ? 'block' : 'none';

    // Reset scroll position when switching tabs
    if (content.dataset.tab === tabId) {
      content.scrollTop = 0;
    }
  });
  
  // Re-initialize Feather icons for newly visible content
  feather.replace();
}

// Get current active tab
export function getCurrentTab() {
  return currentTab;
}

// Initialize navigation
export function initNavigation() {
  // Set initial tab
  switchTab('home');
}

// Export the handler for the button handlers map
export const navigationHandlers = {
  handleTabSwitch: (event) => {
    const tabId = event.target.closest('[data-tab-id]').dataset.tabId;
    switchTab(tabId);
  }
};