import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { createMarketStatus } from '../../common/MarketStatus/MarketStatus.js';
import { getMarketId } from '../../../utils/marketStatus.js';
import { marketDataService } from '../../../services/marketDataService.js';
import { DEFAULT_REFRESH_INTERVAL } from '../../../constants/marketConstants.js';

function createIndexItem({ name, value, change, changePercent }) {
	// Handle null/undefined values
	const safeValue = value ?? 0;
	const safeChange = change ?? 0;
	const safeChangePercent = changePercent ?? 0;

	const isPositive = safeChange >= 0;
	const changeClass = isPositive ? 'positive' : 'negative';
	const marketId = getMarketId(name);

	return `
    <div class="index-item">
      ${createMarketStatus(marketId)}
      <div class="index-name">
        ${name || 'Unknown'}
      </div>
      <div class="index-value">${safeValue.toFixed(2)}</div>
      <div class="index-change ${changeClass}">
        ${isPositive ? '+' : ''}${safeChange.toFixed(2)} (${safeChangePercent.toFixed(2)}%)
      </div>
    </div>
  `;
}

function createLoadingState() {
	return `
    <div class="market-indices loading">
      <div class="loading-message">
        <i data-feather="${ICONS.loader}"></i>
        Loading market data...
      </div>
    </div>
  `;
}

function createErrorState(error) {
	return `
    <div class="market-indices error">
      <div class="error-message">
        <i data-feather="${ICONS.alertTriangle}"></i>
        ${error}
      </div>
    </div>
  `;
}

// Helper function to convert HTML string to DOM element
function createElementFromHTML(htmlString) {
	const div = document.createElement('div');
	div.innerHTML = htmlString.trim();
	return div.firstElementChild;
}

export async function createMarketIndicesCard() {
	let isMounted = true;
	let refreshInterval;
	let retryCount = 0;
	const MAX_RETRIES = 3;
	const RETRY_DELAY = 2000; // 2 seconds

	// Create initial card with loading state
	const cardElement = createElementFromHTML(createCard({
		title: 'Market Indices',
		icon: ICONS.barChart2,
		content: createLoadingState()
	}));

	const updateContent = async () => {
		if (!isMounted) return;

		try {
			const indices = await marketDataService.getAvailableIndices();
			if (!isMounted) return;

			if (!Array.isArray(indices) || indices.length === 0) {
				throw new Error('No market data available');
			}

			const content = `
        <div class="market-indices">
          ${indices.map(index => createIndexItem(index)).join('')}
        </div>
      `;

			const contentElement = cardElement.querySelector('.card__content');
			if (contentElement) {
				contentElement.innerHTML = content;
			}

			// Reset retry count on successful update
			retryCount = 0;
		} catch (error) {
			console.error('Error updating market indices:', error);
			if (!isMounted) return;

			const contentElement = cardElement.querySelector('.card__content');
			if (contentElement) {
				contentElement.innerHTML = createErrorState('Unable to fetch market data. Please try again later.');
			}

			// Optional: Retry logic can stay or be removed based on your needs
			if (retryCount < MAX_RETRIES) {
				retryCount++;
				console.log(`Retrying update (${retryCount}/${MAX_RETRIES})...`);
				setTimeout(updateContent, RETRY_DELAY);
			}
		}
	};

	// Initial data load
	await updateContent();

	// Set up auto-refresh if initial load was successful
	if (cardElement.querySelector('.market-indices:not(.error)')) {
		refreshInterval = setInterval(updateContent, DEFAULT_REFRESH_INTERVAL);
	}

	// Add cleanup method to the card
	cardElement.cleanup = () => {
		isMounted = false;
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	};

	return cardElement;
}