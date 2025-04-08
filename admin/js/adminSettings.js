import { updateAnalyticsConfig } from './analyticsService.js';

/**
 * Admin settings service for storing admin preferences
 */
class AdminSettings {
  constructor() {
    this.storageKey = 'adminSettings';
    this.defaultSettings = {
      enableAnalyticsTracking: true, // Enable analytics tracking by default
      refreshRate: 30000, // Default refresh rate: 30 seconds
      theme: 'light' // Default theme
    };
    this.settings = null;
    this.listeners = new Set();
    
    // Initialize settings
    this.initialize();
  }
  
  /**
   * Initialize settings from localStorage
   */
  initialize() {
    try {
      const storedSettings = localStorage.getItem(this.storageKey);
      if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
      } else {
        this.settings = { ...this.defaultSettings };
        this.saveSettings();
      }
    } catch (error) {
      console.error('Failed to initialize admin settings:', error);
      this.settings = { ...this.defaultSettings };
    }
    
    return this.settings;
  }
  
  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save admin settings:', error);
    }
  }
  
  /**
   * Get all settings
   * @returns {Object} Current settings
   */
  getSettings() {
    if (!this.settings) {
      this.initialize();
    }
    return this.settings;
  }
  
  /**
   * Update a specific setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  updateSetting(key, value) {
    if (!this.settings) {
      this.initialize();
    }
    
    this.settings[key] = value;
    this.saveSettings();
    
    // If updating analytics tracking, update the API configuration
    if (key === 'enableAnalyticsTracking') {
      this.updateApiAnalyticsConfig(value);
    }
    
    return this.settings;
  }
  
  /**
   * Reset settings to defaults
   */
  resetSettings() {
    this.settings = { ...this.defaultSettings };
    this.saveSettings();
    return this.settings;
  }
  
  /**
   * Add a listener for settings changes
   * @param {Function} callback - Callback function
   */
  addListener(callback) {
    this.listeners.add(callback);
  }
  
  /**
   * Remove a listener
   * @param {Function} callback - Callback function
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }
  
  /**
   * Notify all listeners of settings changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.settings);
      } catch (error) {
        console.error('Error in admin settings listener:', error);
      }
    });
  }
  
  /**
   * Update the API analytics configuration
   * @param {boolean} enabled - Whether analytics tracking is enabled
   */
  async updateApiAnalyticsConfig(enabled) {
    try {
      await updateAnalyticsConfig(enabled);
      console.log(`Analytics tracking ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Failed to update API analytics config:', error);
      // Don't revert the setting in the UI, as the server might still be configured correctly
    }
  }
}

// Create a singleton instance
const adminSettings = new AdminSettings();

export default adminSettings;