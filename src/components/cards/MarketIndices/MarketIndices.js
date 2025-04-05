import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { createMarketStatus } from '../../common/MarketStatus/MarketStatus.js';
import { getMarketId } from '../../../utils/marketStatus.js';
import { marketDataService } from '../../../services/marketDataService.js';
import { DEFAULT_REFRESH_INTERVAL, MAX_RETRIES, RETRY_DELAY } from '../../../constants/marketConstants.js';
import { createElementFromHTML } from '../../../utils/dom.js';

// Helper function to convert currency codes to symbols
function getCurrencySymbol(currencyCode) {
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'RUB': '₽',
    'KRW': '₩',
    'BRL': 'R$',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'Fr',
    'HKD': 'HK$',
    'SGD': 'S$',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'TRY': '₺',
    'MXN': 'Mex$',
    'ZAR': 'R'
  };

  // Return the symbol if found, otherwise return the currency code
  return currencySymbols[currencyCode] || currencyCode;
}

function createIndexItem({ name, value, change, changePercent, additionalData = {} }) {
	// Handle null/undefined values
	const safeValue = value ?? 0;
	const safeChange = change ?? 0;
	const safeChangePercent = changePercent ?? 0;

	const isPositive = safeChange >= 0;
	const changeClass = isPositive ? 'positive' : 'negative';
	const marketId = getMarketId(name);
	
	// Get technical rating if available
	const technicalRating = additionalData.technicalRating || '';
	const ratingClass = technicalRating.toLowerCase().includes('buy') ? 'positive' :
	                    technicalRating.toLowerCase().includes('sell') ? 'negative' : '';
	
	// Get high/low prices if available
	const highPrice = additionalData.highPrice ? `H: ${parseFloat(additionalData.highPrice).toFixed(2)} ↑` : '';
	const lowPrice = additionalData.lowPrice ? `L: ${parseFloat(additionalData.lowPrice).toFixed(2)} ↓` : '';
	
	// Create front face with essential info
	const frontFace = `
		<div class="index-face index-face-front">
			<div class="index-name">
				${name || 'Unknown'}
			</div>
			<div class="index-value">${safeValue.toFixed(2)}</div>
			<div class="index-change ${changeClass}">
				${isPositive ? '+' : ''}${safeChange.toFixed(2)} (${safeChangePercent.toFixed(2)}%)
			</div>
		</div>
	`;
	
	// Create back face with additional details
	const backFace = `
		<div class="index-face index-face-back">
			<div class="index-name">
				${name || 'Unknown'}
			</div>
			
			<div class="index-details">
				${highPrice ? `<div class="index-high-low high-value">${highPrice}</div>` : ''}
				${lowPrice ? `<div class="index-high-low low-value">${lowPrice}</div>` : ''}
			</div>
			${additionalData.currency ? `<div class="index-currency">${getCurrencySymbol(additionalData.currency)}</div>` : ''}
		</div>
	`;

	return `
    <div class="index-item" data-index="${name}">
      ${createMarketStatus(marketId)}
      <div class="index-item-inner">
        ${frontFace}
        ${backFace}
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

export async function createMarketIndicesCard() {
	let isMounted = true;
	let refreshInterval;
	let retryCount = 0;
	const flipIntervals = []; // Use const to avoid reassignment

	// Create initial card with loading state
	const cardElement = createElementFromHTML(createCard({
		title: 'Market Indices',
		icon: ICONS.barChart2,
		content: createLoadingState()
	}));

	// Define the toggle flip function at the module level for proper event listener removal
	const toggleFlip = function() {
		this.classList.toggle('flipping');
	};
	
	// Function to set up the flipping animation
	const setupFlippingAnimation = () => {
		if (!isMounted) return;
		
		const indexItems = cardElement.querySelectorAll('.index-item');
		if (!indexItems.length) return;
		
		// Clear any existing flip timeouts
		while (flipIntervals.length) {
			clearTimeout(flipIntervals.pop());
		}
		
		// Add click event listeners for manual flipping
		indexItems.forEach(item => {
			// Remove existing listeners to prevent duplicates
			item.removeEventListener('click', toggleFlip);
			
			// Add click listener for manual flipping
			item.addEventListener('click', toggleFlip);
		});
		
		// Set up automatic flipping for each index item with a staggered start
		indexItems.forEach((item, index) => {
			// Calculate delays based on index for a wave effect
			const startDelay = 2000 + (index * 800); // Initial delay plus stagger
			const flipDuration = 5000; // How long to show each side
			const cycleTime = 10000; // Total time for a complete flip cycle
			
			// Create a state machine for each card
			let flipState = {
				isFlipped: false,
				timeoutId: null
			};
			
			// Function to handle the flip cycle
			const flipCycle = () => {
				if (!isMounted) return;
				
				// Toggle flip state
				flipState.isFlipped = !flipState.isFlipped;
				item.classList.toggle('flipping', flipState.isFlipped);
				
				// Schedule next flip
				flipState.timeoutId = setTimeout(flipCycle, flipState.isFlipped ? flipDuration : (cycleTime - flipDuration));
			};
			
			// Start the flip cycle after initial delay
			flipState.timeoutId = setTimeout(flipCycle, startDelay);
			
			// Store the timeout ID for cleanup
			flipIntervals.push(flipState.timeoutId);
		});
	};

	const updateContent = async () => {
		if (!isMounted) return;

		try {
			const indices = await marketDataService.getAvailableIndices(); 
			if (!isMounted) return;

			if (!Array.isArray(indices) || indices.length === 0) {
				throw new Error('No market data available');
			}

			// Log the indices data for debugging
			console.log('Market indices data:', indices);

			const content = `
        <div class="market-indices">
          ${indices.map(index => createIndexItem({
            name: index.name,
            value: index.value,
            change: index.change,
            changePercent: index.changePercent,
            additionalData: index.additionalData
          })).join('')}
        </div>
      `;

			const contentElement = cardElement.querySelector('.card__content');
			if (contentElement) {
				contentElement.innerHTML = content;
				
				// Set up the flipping animation
				setupFlippingAnimation();
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
		
		// Clear all flip timeouts (we're using setTimeout for flipping)
		while (flipIntervals.length) {
			clearTimeout(flipIntervals.pop());
		}
		
		// Remove event listeners from index items
		const indexItems = cardElement.querySelectorAll('.index-item');
		indexItems.forEach(item => {
			// Remove the click event listener with the same function reference
			item.removeEventListener('click', toggleFlip);
			
			// Also remove the flipping class if it's present
			item.classList.remove('flipping');
		});
	};

	return cardElement;
}