import { ICONS } from '../../../utils/icons.js';

const TABS = [
  { id: 'home', label: 'Home', icon: ICONS.home },
  { id: 'watchlists', label: 'Watchlists', icon: ICONS.star },
  { id: 'markets', label: 'Markets', icon: ICONS.barChart2 },
  { id: 'news', label: 'News', icon: ICONS.globe },
  { id: 'settings', label: 'Settings', icon: ICONS.settings }
];

function createTabItem({ id, label, icon }, isActive = false) {
  const button = document.createElement('button');
  button.className = `tab-item ${isActive ? 'active' : ''}`;
  button.dataset.tab = id;
  button.dataset.action = 'handleTabSwitch';
  button.dataset.tabId = id;
  button.title = label;
  
  const iconElement = document.createElement('i');
  iconElement.dataset.feather = icon;
  button.appendChild(iconElement);
  
  return button;
}

export function createTabNavigation(activeTab = 'home') {
  const nav = document.createElement('nav');
  nav.className = 'tab-navigation';
  
  TABS.forEach(tab => {
    nav.appendChild(createTabItem(tab, tab.id === activeTab));
  });
  
  return nav;
}