import Dashboard from './dashboard.js';
import SettingsPanel from './settingsPanel.js';
import adminSettings from './adminSettings.js';

/**
 * Admin Page Component
 * Container for admin features including the analytics dashboard
 */
export default class AdminPage {
  constructor(container) {
    this.container = container;
    this.dashboard = null;
    this.settingsPanel = null;
    this.currentView = 'dashboard'; // Default view
  }

  /**
   * Initialize the admin page
   */
  async init() {
    this.render();
    this.addEventListeners();
    this.showView(this.currentView);
  }

  /**
   * Render the admin page structure
   */
  render() {
    this.container.innerHTML = '';
    
    // Create admin header
    const header = document.createElement('header');
    header.className = 'admin-header';
    header.innerHTML = `
      <h1>Market Pulse Admin</h1>
      <nav class="admin-nav">
        <ul>
          <li class="${this.currentView === 'dashboard' ? 'active' : ''}"><a href="#dashboard" data-view="dashboard">Dashboard</a></li>
          <li class="${this.currentView === 'settings' ? 'active' : ''}"><a href="#settings" data-view="settings">Settings</a></li>
        </ul>
      </nav>
    `;
    
    // Create content area
    const content = document.createElement('main');
    content.className = 'admin-content';
    content.innerHTML = `
      <div id="dashboard-container" class="dashboard-container" style="display: ${this.currentView === 'dashboard' ? 'block' : 'none'}"></div>
      <div id="settings-container" class="settings-container" style="display: ${this.currentView === 'settings' ? 'block' : 'none'}"></div>
    `;
    
    this.container.appendChild(header);
    this.container.appendChild(content);
  }

  /**
   * Add event listeners
   */
  addEventListeners() {
    // Navigation links
    const navLinks = this.container.querySelectorAll('.admin-nav a');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        this.showView(view);
      });
    });
  }

  /**
   * Show a specific view
   * @param {string} view - View to show ('dashboard' or 'settings')
   */
  showView(view) {
    this.currentView = view;
    
    // Update navigation
    const navItems = this.container.querySelectorAll('.admin-nav li');
    navItems.forEach(item => {
      const link = item.querySelector('a');
      if (link && link.getAttribute('data-view') === view) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Show/hide containers
    const dashboardContainer = document.getElementById('dashboard-container');
    const settingsContainer = document.getElementById('settings-container');
    
    if (dashboardContainer) {
      dashboardContainer.style.display = view === 'dashboard' ? 'block' : 'none';
      
      // Initialize dashboard if needed
      if (view === 'dashboard' && !this.dashboard) {
        this.initDashboard();
      }
    }
    
    if (settingsContainer) {
      settingsContainer.style.display = view === 'settings' ? 'block' : 'none';
      
      // Initialize settings panel if needed
      if (view === 'settings' && !this.settingsPanel) {
        this.initSettingsPanel();
      }
    }
  }

  /**
   * Initialize the dashboard component
   */
  initDashboard() {
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) {
      this.dashboard = new Dashboard(dashboardContainer);
      
      // Apply settings to dashboard
      const settings = adminSettings.getSettings();
      if (settings && settings.refreshRate) {
        this.dashboard.refreshRate = settings.refreshRate;
      }
      
      this.dashboard.init();
    }
  }

  /**
   * Initialize the settings panel
   */
  initSettingsPanel() {
    const settingsContainer = document.getElementById('settings-container');
    if (settingsContainer) {
      this.settingsPanel = new SettingsPanel(settingsContainer);
      this.settingsPanel.init();
    }
  }

  /**
   * Clean up when the admin page is removed
   */
  destroy() {
    if (this.dashboard) {
      this.dashboard.destroy();
    }
    
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
    }
  }
}