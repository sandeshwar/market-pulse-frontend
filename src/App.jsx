import { useState, useEffect } from 'react';
import { TabNavigation } from './components/ExpandedPanel/TabNavigation/TabNavigation.jsx';
import { HomeTab } from './components/ExpandedPanel/Tabs/HomeTab.jsx';
import { NewsTab } from './components/ExpandedPanel/Tabs/NewsTab.jsx';
import { SettingsTab } from './components/ExpandedPanel/Tabs/SettingsTab.jsx';
import { Branding } from './components/common/Branding/Branding.jsx';
import { replaceIcons } from './utils/feather.js';
import './styles/global.css';

const App = () => {
  const [currentTab, setCurrentTab] = useState('home');
  const [loading, setLoading] = useState(true);

  // Initialize the application
  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize Feather icons
        await replaceIcons();
        
        // Hide loading screen with fade-out animation
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
          loadingScreen.classList.add('fade-out');
          setTimeout(() => {
            loadingScreen.remove();
          }, 300);
        }
      } catch (error) {
        console.error('Failed to initialize application:', error);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    // Initialize side panel behavior for Chrome extension
    if (chrome.sidePanel) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  }, []);

  // Handle tab switching
  const handleTabSwitch = (tabId) => {
    setCurrentTab(tabId);
    // Reset scroll position when switching tabs
    window.scrollTo(0, 0);
  };

  // Render the appropriate tab content based on currentTab
  const renderTabContent = () => {
    switch (currentTab) {
      case 'home':
        return <HomeTab />;
      case 'news':
        return <NewsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <HomeTab />;
    }
  };

  if (loading) {
    // Loading state is handled by the HTML skeleton in index.html
    return null;
  }

  // Error state
  if (false) { // This would be a state variable in a real implementation
    return (
      <div className="wireframe-container">
        <div className="side-panel-container">
          <div className="side-panel">
            <div className="error-state">
              <i data-feather="alert-triangle"></i>
              <p>Failed to load application. Please try again later.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wireframe-container">
      <div className="side-panel-container">
        <div className="side-panel">
          <TabNavigation activeTab={currentTab} onTabSwitch={handleTabSwitch} />
          <div className="panel-content">
            {renderTabContent()}
          </div>
          <Branding />
        </div>
      </div>
    </div>
  );
};

export default App;