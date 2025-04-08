import Dashboard from './Dashboard.js';
import { createElement } from '../../utils/dom.js';

/**
 * Admin Page Component
 * Container for admin features including the analytics dashboard
 */
export default class AdminPage {
  constructor(container) {
    this.container = container;
    this.dashboard = null;
  }

  /**
   * Initialize the admin page
   */
  async init() {
    this.render();
    this.initDashboard();
  }

  /**
   * Render the admin page structure
   */
  render() {
    this.container.innerHTML = '';
    
    // Create admin header
    const header = createElement('header', { className: 'admin-header' }, [
      createElement('h1', { textContent: 'Market Pulse Admin' }),
      createElement('nav', { className: 'admin-nav' }, [
        createElement('ul', {}, [
          createElement('li', { className: 'active' }, [
            createElement('a', { href: '#dashboard', textContent: 'Dashboard' })
          ]),
          createElement('li', {}, [
            createElement('a', { href: '#settings', textContent: 'Settings' })
          ])
        ])
      ])
    ]);
    
    // Create content area
    const content = createElement('main', { className: 'admin-content' }, [
      createElement('div', { id: 'dashboard-container', className: 'dashboard-container' })
    ]);
    
    this.container.appendChild(header);
    this.container.appendChild(content);
  }

  /**
   * Initialize the dashboard component
   */
  initDashboard() {
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) {
      this.dashboard = new Dashboard(dashboardContainer);
      this.dashboard.init();
    }
  }

  /**
   * Clean up when the admin page is removed
   */
  destroy() {
    if (this.dashboard) {
      this.dashboard.destroy();
    }
  }
}