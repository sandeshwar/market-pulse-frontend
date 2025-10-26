import React from 'react';
import { createRoot } from 'react-dom/client';
import { MarketIndicesCard } from './MarketIndicesCard.jsx';

/**
 * Creates a DOM element with a React MarketIndicesCard component rendered inside it.
 * Returns an element with a cleanup() method for parity with other card creators.
 */
export async function createMarketIndicesCard({ title = 'Market Indices' } = {}) {
  const containerElement = document.createElement('div');
  containerElement.className = 'market-indices-card-container';

  const root = createRoot(containerElement);
  root.render(React.createElement(MarketIndicesCard, { title }));

  let isMounted = true;
  containerElement.cleanup = () => {
    if (isMounted) {
      isMounted = false;
      root.unmount();
      console.log('MarketIndicesCard React component unmounted');
    }
  };

  return containerElement;
}
