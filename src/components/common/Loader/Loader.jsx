import './Loader.css';

/**
 * Loader component that can be used throughout the application
 * @param {Object} props - Component props
 * @param {string} [props.size='medium'] - Size of the loader ('small', 'medium', 'large')
 * @param {string} [props.type='spinner'] - Type of loader ('spinner', 'pulse', 'dots')
 * @param {string} [props.color] - Custom color for the loader (uses accent-neutral by default)
 * @param {string} [props.text] - Optional text to display below the loader
 * @param {boolean} [props.fullScreen=false] - Whether the loader should take up the full screen
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} Loader component
 */
const Loader = ({ 
  size = 'medium', 
  type = 'spinner',
  color,
  text,
  fullScreen = false,
  className = ''
}) => {
  const loaderClasses = `loader loader-${size} loader-${type} ${className}`;
  const containerClasses = `loader-container ${fullScreen ? 'loader-fullscreen' : ''}`;
  
  const loaderStyle = color ? { '--loader-color': color } : {};
  
  const renderLoader = () => {
    switch (type) {
      case 'pulse':
        return (
          <div className={loaderClasses} style={loaderStyle}>
            <div className="loader-pulse"></div>
          </div>
        );
      case 'dots':
        return (
          <div className={loaderClasses} style={loaderStyle}>
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
            <div className="loader-dot"></div>
          </div>
        );
      case 'spinner':
      default:
        return (
          <div className={loaderClasses} style={loaderStyle}>
            <svg viewBox="0 0 50 50" className="loader-svg">
              <circle 
                className="loader-circle" 
                cx="25" 
                cy="25" 
                r="20" 
                fill="none" 
                strokeWidth="5"
              ></circle>
            </svg>
          </div>
        );
    }
  };

  return (
    <div className={containerClasses}>
      {renderLoader()}
      {text && <p className="loader-text">{text}</p>}
    </div>
  );
};

export default Loader;