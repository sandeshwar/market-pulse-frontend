import React from 'react';

/**
 * Branding component to be displayed in the bottom right corner
 * @returns {JSX.Element} The branding component
 */
const Branding = () => {
  return (
    <a 
      className="branding"
      href="https://luminera.ai/"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="branding__prefix">By</span>
      <span className="branding__text">Luminera AI</span>
    </a>
  );
};

export default Branding;