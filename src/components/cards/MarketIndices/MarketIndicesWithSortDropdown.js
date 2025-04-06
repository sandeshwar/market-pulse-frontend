import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';
import { createMarketStatus } from '../../common/MarketStatus/MarketStatus.js';
import { getMarketId } from '../../../utils/marketStatus.js';
import { marketDataService } from '../../../services/marketDataService.js';
import { DEFAULT_REFRESH_INTERVAL, MAX_RETRIES, RETRY_DELAY } from '../../../constants/marketConstants.js';
import { createElementFromHTML } from '../../../utils/dom.js';
import { indicesWatchlistService } from '../../../services/indicesWatchlistService.js';
import { ensureDefaultIndicesWatchlist } from '../../../utils/indicesWatchlistUtils.js';
import { createSortDropdown } from '../../common/SortDropdown/SortDropdown.js';
import { replaceIcons } from '../../../utils/feather.js';

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
	
	// Current sort state
	let currentSortField = 'name';
	let currentSortDirection = 'asc';
	
	// Add a listener for watchlist changes with immediate refresh
	const handleWatchlistUpdate = (updatedWatchlists) => {
		console.log('Indices watchlist updated, refreshing display immediately', updatedWatchlists);
		
		// Force immediate update without waiting for the next refresh interval
		// Cancel any pending updates first
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		
		// Update content immediately
		updateContent();
		
		// Reset the refresh interval
		if (isMounted) {
			refreshInterval = setInterval(updateContent, DEFAULT_REFRESH_INTERVAL);
		}
	};

	// Create initial card with loading state
	const cardElement = createElementFromHTML(createCard({
		title: 'Market Indices',
		icon: ICONS.trendingUp,
		content: createLoadingState()
	}));
	
	// Define sort fields
	const sortFields = [
		{ id: 'name', label: 'Name' },
		{ id: 'value', label: 'Value' },
		{ id: 'change', label: 'Change' },
		{ id: 'changePercent', label: 'Percent Change' }
	];
	
	// Create sort dropdown
	const sortDropdown = createSortDropdown({
		fields: sortFields,
		defaultField: currentSortField,
		defaultDirection: currentSortDirection,
		onSort: (field, direction) => {
			currentSortField = field;
			currentSortDirection = direction;
			updateContent();
		}
	});
	
	// Add sort dropdown to card header
	const cardHeader = cardElement.querySelector('.card__header');
	
	// Create a container for the sort dropdown if it doesn't exist
	let actionsContainer = cardElement.querySelector('.card__actions');
	if (!actionsContainer) {
		actionsContainer = document.createElement('div');
		actionsContainer.className = 'card__actions';
		cardHeader.appendChild(actionsContainer);
	}
	
	// Add the sort dropdown to the actions container
	actionsContainer.appendChild(sortDropdown);
	
	// Make sure icons are replaced
	setTimeout(() => {
		replaceIcons();
	}, 0);

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
			// Get all available indices from the market data service
			const allIndices = await marketDataService.getAvailableIndices(); 
			if (!isMounted) return;

			if (!Array.isArray(allIndices) || allIndices.length === 0) {
				throw new Error('No market data available');
			}

			// Try to get user's preferred indices from storage
			let userIndices = [];
			try {
				const watchlist = await ensureDefaultIndicesWatchlist();
				if (watchlist && watchlist.indices && watchlist.indices.length > 0) {
					userIndices = watchlist.indices;
					console.log('Using user preferred indices:', userIndices);
				}
			} catch (storageError) {
				console.warn('Could not load user indices preferences:', storageError);
				// Continue with location-based defaults if we can't get user preferences
			}

			// Define major global indices that should always be shown if available
			const majorGlobalIndices = ['SPX', 'DJI', 'IXIC', 'FTSE', 'N225', 'HSI'];
			
			// Filter indices based on user preferences if available
			let indicesToShow = [];
			
			if (userIndices.length > 0) {
				// Filter to only show indices that the user has selected
				indicesToShow = allIndices.filter(index => 
					userIndices.includes(index.name)
				);
				
				// If no matches found (possibly due to symbol name differences), 
				// we'll fall back to location-based defaults below
				if (indicesToShow.length === 0) {
					console.warn('No matching indices found in user preferences, will use location-based defaults');
				}
			}
			
			// If no user preferences or no matches, use location-based defaults
			if (indicesToShow.length === 0) {
				// Try to get user's location/country
				let userCountry = '';
				try {
					// Check if navigator.language is available (browser setting)
					if (navigator.language) {
						// Extract country code from locale (e.g., 'en-US' -> 'US')
						const localeParts = navigator.language.split('-');
						if (localeParts.length > 1) {
							userCountry = localeParts[1].toUpperCase();
						}
					}
					
					console.log('Detected user country:', userCountry);
				} catch (error) {
					console.warn('Could not detect user country:', error);
				}
				
				// Map of country codes to relevant indices
				const countryIndicesMap = {
					'US': ['SPX', 'DJI', 'IXIC', 'RUT'],
					'GB': ['FTSE', 'UKX', 'MCX'],
					'JP': ['N225', 'TOPX'],
					'HK': ['HSI', 'HSCE'],
					'CN': ['SSEC', 'SZSC', 'CSI300'],
					'IN': ['NSEI', 'BSESN'],
					'DE': ['GDAXI', 'MDAXI'],
					'FR': ['FCHI', 'CAC40'],
					'AU': ['AXJO', 'AORD'],
					'CA': ['GSPTSE', 'TSX'],
					'BR': ['BVSP', 'IBOV'],
					'SG': ['STI'],
					'KR': ['KS11', 'KOSPI'],
					// Add more countries as needed
				};
				
				// Get indices for user's country
				let countryIndices = [];
				if (userCountry && countryIndicesMap[userCountry]) {
					countryIndices = countryIndicesMap[userCountry];
				} else {
					// Default to US indices if country not detected or not in our map
					countryIndices = countryIndicesMap['US'];
				}
				
				// Combine country-specific indices with major global indices
				// Remove duplicates (some country indices might already be in global indices)
				const defaultIndicesSet = new Set([...countryIndices, ...majorGlobalIndices]);
				
				// Filter available indices to match our default set
				indicesToShow = allIndices.filter(index => 
					defaultIndicesSet.has(index.name)
				);
				
				// If still no matches (unlikely but possible), show top 5 indices
				if (indicesToShow.length === 0) {
					console.warn('No matching indices found for defaults, showing top 5');
					indicesToShow = allIndices.slice(0, 5);
				}
			}

			// Log the indices data for debugging
			console.log('Market indices data to display:', indicesToShow);
			
			// Sort the indices based on current sort field and direction
			const sortedIndices = [...indicesToShow].sort((a, b) => {
				let aValue, bValue;
				
				// Determine which field to sort by
				switch (currentSortField) {
					case 'name':
						aValue = a.name;
						bValue = b.name;
						break;
					case 'value':
						aValue = a.value || 0;
						bValue = b.value || 0;
						break;
					case 'change':
						aValue = a.change || 0;
						bValue = b.change || 0;
						break;
					case 'changePercent':
						aValue = a.changePercent || 0;
						bValue = b.changePercent || 0;
						break;
					default:
						aValue = a.name;
						bValue = b.name;
				}
				
				// Apply sort direction
				if (currentSortDirection === 'asc') {
					return aValue > bValue ? 1 : -1;
				} else {
					return aValue < bValue ? 1 : -1;
				}
			});

			const content = `
				<div class="market-indices">
					${sortedIndices.map(index => createIndexItem({
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
				
				// Replace icons
				replaceIcons();
			}

			// Reset retry count on successful update
			retryCount = 0;
		} catch (error) {
			console.error('Error updating market indices:', error);
			if (!isMounted) return;

			const contentElement = cardElement.querySelector('.card__content');
			if (contentElement) {
				contentElement.innerHTML = createErrorState('Unable to fetch market data. Please try again later.');
				
				// Replace icons
				replaceIcons();
			}

			// Optional: Retry logic can stay or be removed based on your needs
			if (retryCount < MAX_RETRIES) {
				retryCount++;
				console.log(`Retrying update (${retryCount}/${MAX_RETRIES})...`);
				setTimeout(updateContent, RETRY_DELAY);
			}
		}
	};

	// Register the watchlist update listener
	indicesWatchlistService.addListener(handleWatchlistUpdate);
	
	// Initial data load
	await updateContent();

	// Set up auto-refresh if initial load was successful
	if (cardElement.querySelector('.market-indices:not(.error)')) {
		refreshInterval = setInterval(updateContent, DEFAULT_REFRESH_INTERVAL);
	}

	// Add cleanup method to the card
	cardElement.cleanup = () => {
		isMounted = false;
		
		// Remove the watchlist update listener
		indicesWatchlistService.removeListener(handleWatchlistUpdate);
		
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