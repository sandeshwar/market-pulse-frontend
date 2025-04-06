import { replaceIcons } from '../../../utils/feather.js';

/**
 * Creates a branding element to be displayed in the bottom right corner
 * @returns {HTMLElement} The branding element
 */
export function createBranding() {
  const branding = document.createElement('a');
  branding.className = 'branding';
  branding.href = 'https://luminera.ai/';
  branding.target = '_blank';
  branding.rel = 'noopener noreferrer';

  // Add "By" text prefix
  const byText = document.createElement('span');
  byText.className = 'branding__prefix';
  byText.textContent = 'By';

  const brandingText = document.createElement('span');
  brandingText.className = 'branding__text';
  brandingText.textContent = 'Luminera AI';

  branding.appendChild(byText);
  branding.appendChild(brandingText);

  return branding;
}