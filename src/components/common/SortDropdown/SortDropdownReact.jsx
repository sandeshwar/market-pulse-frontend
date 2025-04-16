import { useState, useRef, useEffect } from 'react';
import { ICONS } from '../../../utils/icons.js';
import { FeatherIcon } from '../FeatherIcon/FeatherIcon.jsx';
import './SortDropdown.css';

/**
 * React component for a sort dropdown in card headers
 * @param {Object} props - Component props
 * @param {Array} props.fields - Array of field objects with {id, label} properties
 * @param {string} props.defaultField - Default field to sort by
 * @param {string} props.defaultDirection - Default sort direction ('asc' or 'desc')
 * @param {Function} props.onSort - Callback function when sort changes
 * @returns {JSX.Element} The sort dropdown component
 */
export function SortDropdownReact({ 
  fields = [],
  defaultField = fields[0]?.id || 'name',
  defaultDirection = 'asc',
  onSort = () => {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentField, setCurrentField] = useState(defaultField);
  const [currentDirection, setCurrentDirection] = useState(defaultDirection);
  const dropdownRef = useRef(null);
  
  // Handle clicking outside to close the dropdown
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
  
  // Toggle the dropdown menu
  const toggleMenu = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };
  
  // Handle option selection
  const handleOptionClick = (field) => {
    // If clicking the same field, toggle direction
    if (field === currentField) {
      const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
      setCurrentDirection(newDirection);
      onSort(field, newDirection);
    } else {
      // New field, reset to ascending
      setCurrentField(field);
      setCurrentDirection('asc');
      onSort(field, 'asc');
    }
    
    // Close the menu
    setIsOpen(false);
  };
  
  return (
    <div className="sort-dropdown" ref={dropdownRef}>
      <div className="sort-icon" title="Sort options" onClick={toggleMenu}>
        <FeatherIcon 
          icon={ICONS.sortAsc} 
          size={{ width: 16, height: 16 }}
        />
      </div>
      <div className={`sort-menu ${isOpen ? 'active' : ''}`}>
        <div className="sort-menu-header">Sort by</div>
        {fields.map(field => (
          <div
            key={field.id}
            className={`sort-option ${field.id === currentField ? 'active' : ''}`}
            onClick={() => handleOptionClick(field.id)}
          >
            {field.label}
            {field.id === currentField && (
              <span className="sort-direction">
                {currentDirection === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}