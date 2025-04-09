/**
 * Utility functions for working with React in a Chrome extension environment
 * with Content Security Policy (CSP) restrictions.
 */

import { createRoot } from 'react-dom/client';

/**
 * Creates a React root in a CSP-compliant way
 * @param {HTMLElement} container - The DOM element to render into
 * @returns {Object} The React root object
 */
export function createCSPCompliantRoot(container) {
  if (!container) {
    console.error('Cannot create React root: container is null or undefined');
    return null;
  }
  
  try {
    // Use createRoot from react-dom/client
    return createRoot(container);
  } catch (error) {
    console.error('Error creating React root:', error);
    return null;
  }
}

/**
 * Safely unmounts a React root
 * @param {Object} root - The React root to unmount
 */
export function safelyUnmountRoot(root) {
  if (!root) return;
  
  try {
    root.unmount();
  } catch (error) {
    console.error('Error unmounting React root:', error);
  }
}

/**
 * Safely renders a React component to a container
 * @param {HTMLElement} container - The DOM element to render into
 * @param {React.ReactNode} component - The React component to render
 * @returns {Object} The React root object
 */
export function renderReactComponent(container, component) {
  const root = createCSPCompliantRoot(container);
  if (root) {
    try {
      root.render(component);
    } catch (error) {
      console.error('Error rendering React component:', error);
    }
  }
  return root;
}