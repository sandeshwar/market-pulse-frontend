/**
 * Theme Switcher for Admin UI
 * Handles switching between light and dark themes
 */

class ThemeSwitcher {
  constructor() {
    this.themeKey = 'market-pulse-admin-theme';
    this.darkThemeClass = 'theme-dark';
    this.initialize();
  }

  initialize() {
    // Apply theme to loading screen immediately
    this.applyLoadingScreenTheme();
    
    // Apply saved theme on load
    this.applyTheme(this.getSavedTheme());
    
    // Create theme toggle button
    this.createThemeToggle();
  }
  
  /**
   * Apply theme to loading screen before the rest of the page loads
   */
  applyLoadingScreenTheme() {
    const savedTheme = this.getSavedTheme();
    const loadingScreen = document.getElementById('loading-screen');
    
    if (loadingScreen && savedTheme === 'dark') {
      loadingScreen.classList.add('theme-dark-loading');
    }
  }

  /**
   * Get the saved theme from localStorage
   * @returns {string} 'dark' or 'light'
   */
  getSavedTheme() {
    return localStorage.getItem(this.themeKey) || 'light';
  }

  /**
   * Save theme preference to localStorage
   * @param {string} theme - 'dark' or 'light'
   */
  saveTheme(theme) {
    localStorage.setItem(this.themeKey, theme);
  }

  /**
   * Apply the specified theme
   * @param {string} theme - 'dark' or 'light'
   */
  applyTheme(theme) {
    const htmlElement = document.documentElement;
    
    if (theme === 'dark') {
      htmlElement.classList.add(this.darkThemeClass);
    } else {
      htmlElement.classList.remove(this.darkThemeClass);
    }
    
    // Update toggle button icon if it exists
    this.updateToggleIcon(theme);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const currentTheme = this.getSavedTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    this.applyTheme(newTheme);
    this.saveTheme(newTheme);
  }

  /**
   * Create the theme toggle button and add it to the header
   */
  createThemeToggle() {
    // Wait for the admin header to be created
    const checkForHeader = setInterval(() => {
      const header = document.querySelector('.admin-header');
      if (header) {
        clearInterval(checkForHeader);
        
        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.className = 'theme-toggle';
        toggleButton.setAttribute('aria-label', 'Toggle theme');
        toggleButton.setAttribute('title', 'Toggle dark/light theme');
        toggleButton.innerHTML = this.getToggleIcon(this.getSavedTheme());
        
        // Add click event
        toggleButton.addEventListener('click', () => this.toggleTheme());
        
        // Add to header
        header.appendChild(toggleButton);
        
        // Update feather icons
        if (window.feather) {
          feather.replace();
        }
      }
    }, 100);
  }

  /**
   * Get the appropriate icon for the theme toggle based on current theme
   * @param {string} theme - Current theme ('dark' or 'light')
   * @returns {string} HTML for the icon
   */
  getToggleIcon(theme) {
    return theme === 'dark' 
      ? '<i data-feather="sun"></i>' 
      : '<i data-feather="moon"></i>';
  }

  /**
   * Update the toggle button icon when theme changes
   * @param {string} theme - Current theme ('dark' or 'light')
   */
  updateToggleIcon(theme) {
    const toggleButton = document.querySelector('.theme-toggle');
    if (toggleButton) {
      toggleButton.innerHTML = this.getToggleIcon(theme);
      
      // Update feather icons
      if (window.feather) {
        feather.replace();
      }
    }
  }
}

// Initialize theme switcher when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.themeSwitcher = new ThemeSwitcher();
});