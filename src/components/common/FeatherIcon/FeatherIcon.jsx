import { useEffect, useRef } from 'react';
import feather from 'feather-icons';

/**
 * A React component for Feather icons
 * 
 * @param {Object} props - Component props
 * @param {string} props.icon - The name of the Feather icon
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.size - Size of the icon (width and height)
 * @param {string} props.color - Color of the icon
 * @param {Object} props.style - Additional inline styles
 * @returns {JSX.Element} The icon component
 */
export const FeatherIcon = ({ 
  icon, 
  className = '', 
  size = { width: 24, height: 24 },
  color,
  style = {},
  ...otherProps
}) => {
  const iconRef = useRef(null);

  useEffect(() => {
    if (iconRef.current && icon) {
      try {
        // Get the SVG string for the icon
        const svgString = feather.icons[icon]?.toSvg({
          width: size.width,
          height: size.height,
          color,
          ...otherProps
        });

        if (svgString) {
          // Set the HTML content
          iconRef.current.innerHTML = svgString;
        } else {
          console.warn(`Icon "${icon}" not found in Feather icons`);
        }
      } catch (error) {
        console.error(`Error rendering Feather icon "${icon}":`, error);
      }
    }
  }, [icon, size.width, size.height, color, otherProps]);

  const combinedStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style
  };

  return (
    <span 
      ref={iconRef} 
      className={`feather-icon ${className}`}
      style={combinedStyle}
      data-icon={icon}
    />
  );
};