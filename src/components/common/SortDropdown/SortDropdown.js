import { ICONS } from '../../../utils/icons.js';
import { createElementFromHTML } from '../../../utils/dom.js';
import './SortDropdown.css';

/**
 * Creates a sort dropdown component for card headers
 * @param {Object} options - Configuration options
 * @param {Array} options.fields - Array of field objects with {id, label} properties
 * @param {string} options.defaultField - Default field to sort by
 * @param {string} options.defaultDirection - Default sort direction ('asc' or 'desc')
 * @param {Function} options.onSort - Callback function when sort changes
 * @returns {HTMLElement} The sort dropdown element
 */
export function createSortDropdown(options) {
  const {
    fields = [],
    defaultField = fields[0]?.id || 'name',
    defaultDirection = 'asc',
    onSort = () => {}
  } = options;
  
  // Current sort state
  let currentField = defaultField;
  let currentDirection = defaultDirection;
  
  // Create the dropdown element
  const dropdownHTML = `
    <div class="sort-dropdown">
      <div class="sort-icon" title="Sort options">
        <i data-feather="${ICONS.sortAsc}"></i>
      </div>
      <div class="sort-menu">
        <div class="sort-menu-header">Sort by</div>
        ${fields.map(field => `
          <div class="sort-option ${field.id === currentField ? 'active' : ''}" data-field="${field.id}">
            ${field.label}
            ${field.id === currentField ?
              `<span class="sort-direction">${currentDirection === 'asc' ? '↑' : '↓'}</span>` :
              ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  const dropdownElement = createElementFromHTML(dropdownHTML);
  const sortIconContainer = dropdownElement.querySelector('.sort-icon');
  const sortIcon = dropdownElement.querySelector('.sort-icon i');
  const sortMenu = dropdownElement.querySelector('.sort-menu');
  const sortOptions = dropdownElement.querySelectorAll('.sort-option');
  
  // Update the icon based on current sort direction
  const updateSortIcon = () => {
    // We're using the same icon for both directions
    sortIcon.setAttribute('data-feather', ICONS.sortAsc);

    // Make sure Feather icons are redrawn
    if (window.feather) {
      window.feather.replace();
    }
  };
  
  // Update the active option in the menu
  const updateActiveOption = () => {
    sortOptions.forEach(option => {
      const field = option.getAttribute('data-field');
      const isActive = field === currentField;
      
      option.classList.toggle('active', isActive);
      
      // Update the direction indicator
      if (isActive) {
        option.innerHTML = `
          ${fields.find(f => f.id === field).label}
          <span class="sort-direction">${currentDirection === 'asc' ? '↑' : '↓'}</span>
        `;
      } else {
        option.innerHTML = fields.find(f => f.id === field).label;
      }
    });
  };
  
  // Toggle the dropdown menu
  const toggleMenu = (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle('active');
    
    // Add a one-time event listener to close the menu when clicking outside
    if (sortMenu.classList.contains('active')) {
      setTimeout(() => {
        document.addEventListener('click', closeMenu, { once: true });
      }, 0);
    }
  };
  
  // Close the dropdown menu
  const closeMenu = () => {
    sortMenu.classList.remove('active');
  };
  
  // Handle option selection
  const handleOptionClick = (e) => {
    const field = e.currentTarget.getAttribute('data-field');
    
    // If clicking the same field, toggle direction
    if (field === currentField) {
      currentDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, reset to ascending
      currentField = field;
      currentDirection = 'asc';
    }
    
    // Update UI
    updateSortIcon();
    updateActiveOption();
    
    // Close the menu
    closeMenu();
    
    // Call the callback
    onSort(currentField, currentDirection);
  };
  
  // Add event listeners
  sortIconContainer.addEventListener('click', toggleMenu);
  sortOptions.forEach(option => {
    option.addEventListener('click', handleOptionClick);
  });
  
  // Public methods
  dropdownElement.getSort = () => ({
    field: currentField,
    direction: currentDirection
  });
  
  dropdownElement.setSort = (field, direction) => {
    currentField = field || currentField;
    currentDirection = direction || currentDirection;
    updateSortIcon();
    updateActiveOption();
  };
  
  // Initialize the icon
  updateSortIcon();

  // Ensure the icon is properly sized
  setTimeout(() => {
    const iconSvg = dropdownElement.querySelector('.sort-icon svg');
    if (iconSvg) {
      iconSvg.setAttribute('width', '16');
      iconSvg.setAttribute('height', '16');
    }
  }, 0);

  return dropdownElement;
}