// Threshold types
export const THRESHOLD_TYPES = {
  ABOVE: 'above',
  BELOW: 'below'
};

// Store thresholds in localStorage
export function saveThreshold(symbol, price, type) {
  const thresholds = getThresholds();
  thresholds[symbol] = thresholds[symbol] || [];
  thresholds[symbol].push({ price: parseFloat(price), type });
  localStorage.setItem('priceThresholds', JSON.stringify(thresholds));
}

export function getThresholds() {
  const stored = localStorage.getItem('priceThresholds');
  return stored ? JSON.parse(stored) : {};
}

export function removeThreshold(symbol, price, type) {
  const thresholds = getThresholds();
  if (thresholds[symbol]) {
    thresholds[symbol] = thresholds[symbol].filter(
      t => t.price !== price || t.type !== type
    );
    if (thresholds[symbol].length === 0) {
      delete thresholds[symbol];
    }
    localStorage.setItem('priceThresholds', JSON.stringify(thresholds));
  }
}

export function checkThresholds(symbol, currentPrice) {
  const thresholds = getThresholds();
  const symbolThresholds = thresholds[symbol] || [];
  const alerts = [];

  symbolThresholds.forEach(threshold => {
    if (threshold.type === THRESHOLD_TYPES.ABOVE && currentPrice > threshold.price) {
      alerts.push(`${symbol} is above ${threshold.price}`);
    } else if (threshold.type === THRESHOLD_TYPES.BELOW && currentPrice < threshold.price) {
      alerts.push(`${symbol} is below ${threshold.price}`);
    }
  });

  return alerts;
}