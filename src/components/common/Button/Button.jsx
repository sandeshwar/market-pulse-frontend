
import { createRoot } from 'react-dom/client';
import { replaceIcons } from '../../../utils/feather.js';

/**
 * Button component with various display options
 * @param {Object} props - Component props
 * @param {string} [props.id] - Button ID
 * @param {string} [props.icon] - Icon name to display
 * @param {string} [props.text] - Button text
 * @param {Function} [props.onClick] - Click handler function
 * @param {string} [props.title] - Button title/tooltip
 * @param {string} [props.variant='icon'] - Button variant (icon, primary, etc.)
 * @param {boolean} [props.fullWidth=false] - Whether button should take full width
 * @returns {JSX.Element} The button component
 */
export function ButtonReact({ 
  id,
  icon,
  text,
  onClick,
  title,
  variant = 'icon',
  fullWidth = false,
  ...customAttributes
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    fullWidth ? 'btn--full-width' : ''
  ].filter(Boolean).join(' ');

  // Handle onClick function
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      id={id}
      className={classes}
      title={title || ''}
      onClick={handleClick}
      {...customAttributes}
    >
      {icon && <i data-feather={icon}></i>}
      {text && <span>{text}</span>}
    </button>
  );
}

/**
 * Creates a button element with React and returns it
 * @param {Object} options - Button configuration options
 * @param {string} [options.id] - Button ID
 * @param {string} [options.icon] - Icon name to display
 * @param {string} [options.text] - Button text
 * @param {Function|string} [options.onClick] - Click handler function or action name
 * @param {string} [options.title] - Button title/tooltip
 * @param {string} [options.variant='icon'] - Button variant (icon, primary, etc.)
 * @param {boolean} [options.fullWidth=false] - Whether button should take full width
 * @param {Object} [options.customAttributes] - Additional attributes to add to the button
 * @returns {HTMLElement} The button container element
 */
export function createButtonReact(options) {
  // Create a wrapper element
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  
  // Create a unique ID for the React root
  const rootId = `button-react-root-${Math.random().toString(36).substr(2, 9)}`;
  buttonContainer.innerHTML = `<div id="${rootId}"></div>`;
  
  // Process onClick if it's a string (action name)
  let onClickHandler = options.onClick;
  if (typeof options.onClick === 'string') {
    const actionName = options.onClick.replace(/[()]/g, '');
    onClickHandler = (e) => {
      // Try to find and call a global function with this name
      if (typeof window[actionName] === 'function') {
        window[actionName](e);
      } else {
        // Dispatch a custom event that can be listened for
        const customEvent = new CustomEvent('button-action', {
          detail: { action: actionName, event: e }
        });
        document.dispatchEvent(customEvent);
      }
    };
    
    // Add data-action attribute for backward compatibility
    options = {
      ...options,
      'data-action': actionName
    };
  }
  
  // Initialize React component after rendering
  setTimeout(() => {
    const container = buttonContainer.querySelector(`#${rootId}`);
    if (container) {
      const root = createRoot(container);
      root.render(<ButtonReact {...options} onClick={onClickHandler} />);
    }
    
    // Replace icons
    replaceIcons();
  }, 0);
  
  return buttonContainer;
}

export default ButtonReact;