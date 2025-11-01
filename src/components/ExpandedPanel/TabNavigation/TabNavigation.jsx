import { ICONS } from '../../../utils/icons.js';
import { FeatherIcon } from '../../../components/common/FeatherIcon/FeatherIcon.jsx';

const TABS = [
  { id: 'home', label: 'Home', icon: ICONS.home },
  // { id: 'watchlists', label: 'Watchlists', icon: ICONS.star }, // Hiding for now
  // { id: 'markets', label: 'Markets', icon: ICONS.barChart2 }, // Hiding for now
  // { id: 'news', label: 'News', icon: ICONS.globe }, // Temporarily hidden
  { id: 'settings', label: 'Settings', icon: ICONS.settings }
];

export const TabNavigation = ({ activeTab = 'home', onTabSwitch }) => {
  return (
    <nav className="tab-navigation">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tab-item ${tab.id === activeTab ? 'active' : ''}`}
          data-tab={tab.id}
          title={tab.label}
          onClick={() => onTabSwitch(tab.id)}
        >
          <FeatherIcon 
            icon={tab.icon} 
            size={{ width: 20, height: 20 }}
          />
        </button>
      ))}
    </nav>
  );
};