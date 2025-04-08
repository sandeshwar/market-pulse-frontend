import adminSettings from './adminSettings.js';

/**
 * Settings panel component for the admin dashboard
 */
export default class SettingsPanel {
  constructor(container) {
    this.container = container;
    this.settings = null;
  }
  
  /**
   * Initialize the settings panel
   */
  async init() {
    this.settings = adminSettings.getSettings();
    this.render();
    this.addEventListeners();
    
    // Listen for settings changes
    adminSettings.addListener(settings => {
      this.settings = settings;
      this.updateUI();
    });
  }
  
  /**
   * Render the settings panel
   */
  render() {
    this.container.innerHTML = '';
    
    // Create settings header
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.innerHTML = `
      <h2>Admin Settings</h2>
      <p>Configure dashboard and API settings</p>
    `;
    
    // Create settings form
    const form = document.createElement('div');
    form.className = 'settings-form';
    form.innerHTML = `
      <div class="settings-section">
        <h3>Analytics Settings</h3>
        
        <div class="settings-group">
          <label class="settings-label" for="enable-analytics">API Analytics Tracking</label>
          <div class="toggle-group">
            <div class="toggle-switch">
              <input 
                type="checkbox" 
                id="enable-analytics" 
                class="toggle-input" 
                ${this.settings.enableAnalyticsTracking ? 'checked' : ''}
              />
              <label for="enable-analytics" class="toggle-label">
                <span class="toggle-button"></span>
              </label>
            </div>
            <span class="settings-help">
              ${this.settings.enableAnalyticsTracking ? 
                'Analytics tracking is enabled - all API requests are being tracked' : 
                'Analytics tracking is disabled - API requests are not being tracked'}
            </span>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Dashboard Settings</h3>
        
        <div class="settings-group">
          <label class="settings-label" for="refresh-rate-setting">Default Refresh Rate</label>
          <select id="refresh-rate-setting" class="settings-select">
            <option value="5000" ${this.settings.refreshRate === 5000 ? 'selected' : ''}>5 seconds</option>
            <option value="30000" ${this.settings.refreshRate === 30000 ? 'selected' : ''}>30 seconds</option>
            <option value="60000" ${this.settings.refreshRate === 60000 ? 'selected' : ''}>1 minute</option>
            <option value="300000" ${this.settings.refreshRate === 300000 ? 'selected' : ''}>5 minutes</option>
          </select>
        </div>
      </div>
      
      <div class="settings-actions">
        <button id="reset-settings" class="btn btn-secondary">Reset to Defaults</button>
      </div>
    `;
    
    this.container.appendChild(header);
    this.container.appendChild(form);
  }
  
  /**
   * Add event listeners to form elements
   */
  addEventListeners() {
    // Analytics toggle
    const analyticsToggle = this.container.querySelector('#enable-analytics');
    if (analyticsToggle) {
      analyticsToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        adminSettings.updateSetting('enableAnalyticsTracking', enabled);
        
        // Show feedback message
        const helpText = analyticsToggle.closest('.toggle-group').querySelector('.settings-help');
        if (helpText) {
          helpText.textContent = enabled ? 
            'Analytics tracking is enabled - all API requests are being tracked' : 
            'Analytics tracking is disabled - API requests are not being tracked';
          
          // Add animation class
          helpText.classList.add('settings-updated');
          setTimeout(() => {
            helpText.classList.remove('settings-updated');
          }, 1500);
        }
      });
    }
    
    // Refresh rate select
    const refreshRateSelect = this.container.querySelector('#refresh-rate-setting');
    if (refreshRateSelect) {
      refreshRateSelect.addEventListener('change', (e) => {
        const value = parseInt(e.target.value, 10);
        adminSettings.updateSetting('refreshRate', value);
      });
    }
    
    // Reset button
    const resetButton = this.container.querySelector('#reset-settings');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        if (confirm('Reset all settings to defaults?')) {
          adminSettings.resetSettings();
        }
      });
    }
  }
  
  /**
   * Update UI elements based on current settings
   */
  updateUI() {
    // Update analytics toggle
    const analyticsToggle = this.container.querySelector('#enable-analytics');
    if (analyticsToggle) {
      analyticsToggle.checked = this.settings.enableAnalyticsTracking;
    }
    
    // Update refresh rate select
    const refreshRateSelect = this.container.querySelector('#refresh-rate-setting');
    if (refreshRateSelect) {
      refreshRateSelect.value = this.settings.refreshRate.toString();
    }
  }
  
  /**
   * Clean up when the panel is removed
   */
  destroy() {
    // Remove event listeners if needed
  }
}