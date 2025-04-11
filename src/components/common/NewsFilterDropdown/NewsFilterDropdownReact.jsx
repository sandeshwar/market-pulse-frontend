import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { ICONS } from '../../../utils/icons.js';
import { replaceIcons } from '../../../utils/feather.js';
import './NewsFilterDropdown.css';

/**
 * React component for news filter dropdown
 * @param {Object} props - Component props
 * @param {Array} props.modes - Available news modes
 * @param {string} props.currentMode - Currently selected mode
 * @param {Function} props.onChange - Callback when mode changes
 * @param {string} props.ticker - Optional ticker symbol for ticker-specific news
 * @param {Object} ref - Forwarded ref for exposing methods
 */
export const NewsFilterDropdownReact = forwardRef(({ 
  modes = [
    { id: 'trending', label: 'Trending' },
    { id: 'personalized', label: 'For You' },
    { id: 'filtered', label: 'Filtered' }
  ],
  currentMode = 'trending',
  onChange = () => {},
  ticker = null
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(currentMode);
  const dropdownRef = useRef(null);
  const iconRef = useRef(null);
  
  // Create a complete modes array including ticker if provided
  const allModes = [...modes];
  if (ticker) {
    allModes.push({ id: 'ticker', label: ticker });
  }
  
  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    // Get current selected mode
    getCurrentMode: () => selectedMode,
    
    // Set mode programmatically
    setMode: (mode) => {
      if (mode && allModes.some(m => m.id === mode)) {
        setSelectedMode(mode);
      }
    }
  }));
  
  // Toggle the dropdown menu
  const toggleMenu = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };
  
  // Handle option selection
  const handleOptionClick = (mode) => {
    setSelectedMode(mode);
    setIsOpen(false);
    onChange(mode);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Update selected mode if currentMode prop changes
  useEffect(() => {
    setSelectedMode(currentMode);
  }, [currentMode]);
  
  // Initialize Feather icons after component mounts
  useEffect(() => {
    // Replace icons and set proper size
    replaceIcons().then(() => {
      if (iconRef.current) {
        const iconSvg = iconRef.current.querySelector('svg');
        if (iconSvg) {
          iconSvg.setAttribute('width', '16');
          iconSvg.setAttribute('height', '16');
        }
      }
    }).catch(error => {
      console.error('Failed to initialize icons:', error);
    });
  }, []);
  
  return (
    <div className="news-filter-dropdown" ref={dropdownRef}>
      <div className="filter-icon" title="News filter options" onClick={toggleMenu} ref={iconRef}>
        <i data-feather={ICONS.sortAsc}></i>
      </div>
      
      {isOpen && (
        <div className="filter-menu active">
          {allModes.map((mode) => (
            <div 
              key={mode.id}
              className={`filter-option ${mode.id === selectedMode ? 'active' : ''}`}
              onClick={() => handleOptionClick(mode.id)}
            >
              {mode.label}
              {mode.id === selectedMode && <span className="filter-indicator">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});