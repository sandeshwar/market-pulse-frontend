import { ICONS } from '../../../utils/icons.js';
import { createElementFromHTML } from '../../../utils/dom.js';
import { replaceIcons } from '../../../utils/feather.js';

/**
 * Creates a news filter dropdown component
 * @param {Object} options - Configuration options
 * @param {Array} options.modes - Available news modes
 * @param {string} options.currentMode - Currently selected mode
 * @param {Function} options.onChange - Callback when mode changes
 * @param {string} options.ticker - Optional ticker symbol for ticker-specific news
 * @returns {HTMLElement} The news filter dropdown element
 */
export function createNewsFilterDropdown(options) {
  const {
    modes = [
      { id: 'trending', label: 'Trending' },
      { id: 'personalized', label: 'For You' },
      { id: 'filtered', label: 'Filtered' }
    ],
    currentMode = 'trending',
    onChange = () => {},
    ticker = null
  } = options;
  
  // Create a complete modes array including ticker if provided
  const allModes = [...modes];
  if (ticker) {
    allModes.push({ id: 'ticker', label: ticker });
  }
  
  // Create the dropdown element
  const dropdownHTML = `
    <div class="news-filter-dropdown">
      <div class="filter-icon" title="News filter options">
        <i data-feather="${ICONS.sortAsc}"></i>
      </div>
      <div class="filter-menu">
        <div class="filter-menu-header">News Type</div>
        ${allModes.map(mode => `
          <div class="filter-option ${mode.id === currentMode ? 'active' : ''}" data-mode="${mode.id}">
            ${mode.label}
            ${mode.id === currentMode ? '<span class="filter-indicator">✓</span>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  const dropdownElement = createElementFromHTML(dropdownHTML);
  const filterIconContainer = dropdownElement.querySelector('.filter-icon');
  const filterMenu = dropdownElement.querySelector('.filter-menu');
  const filterOptions = dropdownElement.querySelectorAll('.filter-option');
  
  // Update the active option in the menu
  const updateActiveOption = (selectedMode) => {
    filterOptions.forEach(option => {
      const mode = option.getAttribute('data-mode');
      const isActive = mode === selectedMode;
      
      option.classList.toggle('active', isActive);
      
      // Update the indicator
      if (isActive) {
        option.innerHTML = `
          ${allModes.find(m => m.id === mode).label}
          <span class="filter-indicator">✓</span>
        `;
      } else {
        option.innerHTML = allModes.find(m => m.id === mode).label;
      }
    });
  };
  
  // Toggle the dropdown menu
  const toggleMenu = (e) => {
    e.stopPropagation();
    filterMenu.classList.toggle('active');
    
    // Add a one-time event listener to close the menu when clicking outside
    if (filterMenu.classList.contains('active')) {
      setTimeout(() => {
        document.addEventListener('click', closeMenu, { once: true });
      }, 0);
    }
  };
  
  // Close the dropdown menu
  const closeMenu = () => {
    filterMenu.classList.remove('active');
  };
  
  // Handle option selection
  const handleOptionClick = (e) => {
    const mode = e.currentTarget.getAttribute('data-mode');
    
    // Update UI
    updateActiveOption(mode);
    
    // Close the menu
    closeMenu();
    
    // Call the callback
    onChange(mode);
  };
  
  // Add event listeners
  filterIconContainer.addEventListener('click', toggleMenu);
  filterOptions.forEach(option => {
    option.addEventListener('click', handleOptionClick);
  });
  
  // Public methods
  dropdownElement.getCurrentMode = () => currentMode;
  
  dropdownElement.setMode = (mode) => {
    if (mode && allModes.some(m => m.id === mode)) {
      updateActiveOption(mode);
    }
  };
  
  // Ensure the icon is properly sized and rendered
  setTimeout(() => {
    replaceIcons();
    const iconSvg = dropdownElement.querySelector('.filter-icon svg');
    if (iconSvg) {
      iconSvg.setAttribute('width', '16');
      iconSvg.setAttribute('height', '16');
    }
  }, 0);
  
  return dropdownElement;
}