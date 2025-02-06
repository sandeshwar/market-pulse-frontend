import { ICONS } from '../../../utils/icons.js';

const TABS = [
  { id: 'home', label: 'Home', icon: ICONS.home },
  { id: 'watchlists', label: 'Watchlists', icon: ICONS.star },
  { id: 'markets', label: 'Markets', icon: ICONS.barChart2 },
  { id: 'news', label: 'News', icon: ICONS.globe },
  { id: 'settings', label: 'Settings', icon: ICONS.settings }
];

function createTabItem({ id, label, icon }, isActive = false) {
  return `
    <button 
      class="tab-item ${isActive ? 'active' : ''}"
      data-tab="${id}"
      data-action="handleTabSwitch"
      data-tab-id="${id}"
      title="${label}"
    >
      <i data-feather="${icon}"></i>
    </button>
  `;
}

export function createTabNavigation(activeTab = 'home') {
  return `
    <nav class="tab-navigation">
      ${TABS.map(tab => createTabItem(tab, tab.id === activeTab)).join('')}
    </nav>
  `;
}