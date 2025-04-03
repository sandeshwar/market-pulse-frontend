class WatchlistService {
    constructor() {
        this.storageKey = 'watchlists';
        this.initialized = false;
        this.listeners = new Set();
        
        // Listen for storage changes
        if (chrome.storage) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync' && changes[this.storageKey]) {
                    this.notifyListeners(changes[this.storageKey].newValue);
                }
            });
        }
    }

    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(watchlists) {
        this.listeners.forEach(callback => callback(watchlists));
    }

    async initializeStorage() {
        if (this.initialized) return;
        
        try {
            // Check if we're in a Chrome extension context
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
                throw new Error('Chrome extension storage is not available');
            }

            const data = await chrome.storage.sync.get(this.storageKey);
            if (!data[this.storageKey]) {
                await chrome.storage.sync.set({ [this.storageKey]: [] });
            }
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize watchlist storage:', error);
            throw new Error('Failed to initialize watchlist storage. Please check extension permissions.');
        }
    }

    async getWatchlists() {
        await this.initializeStorage();
        try {
            const data = await chrome.storage.sync.get(this.storageKey);
            return data[this.storageKey] || [];
        } catch (error) {
            console.error('Failed to get watchlists:', error);
            return [];
        }
    }

    async createWatchlist(name) {
        const watchlists = await this.getWatchlists();
        if (watchlists.find(w => w.name === name)) {
            throw new Error('Watchlist with this name already exists');
        }

        const newWatchlist = {
            name,
            symbols: [],
            created: Date.now()
        };

        watchlists.push(newWatchlist);
        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        return newWatchlist;
    }

    async renameWatchlist(oldName, newName) {
        const watchlists = await this.getWatchlists();
        const watchlist = watchlists.find(w => w.name === oldName);
        if (!watchlist) {
            throw new Error('Watchlist not found');
        }

        watchlist.name = newName;
        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        return watchlist;
    }

    async deleteWatchlist(name) {
        const watchlists = await this.getWatchlists();
        const updatedWatchlists = watchlists.filter(w => w.name !== name);
        await chrome.storage.sync.set({ [this.storageKey]: updatedWatchlists });
        return true;
    }

    async addSymbol(watchlistName, symbolData) {
        const watchlists = await this.getWatchlists();
        const watchlist = watchlists.find(w => w.name === watchlistName);

        if (!watchlist) {
            throw new Error('Watchlist not found');
        }

        // Handle both string and object formats for backward compatibility
        const symbolStr = typeof symbolData === 'string' ? symbolData : symbolData.symbol;

        // Check if the symbol already exists in the watchlist
        const existingIndex = watchlist.symbolsData ?
            watchlist.symbolsData.findIndex(item => item.symbol === symbolStr) : -1;

        if (existingIndex >= 0 || watchlist.symbols.includes(symbolStr)) {
            throw new Error('Symbol already in watchlist');
        }

        // Initialize symbolsData array if it doesn't exist
        if (!watchlist.symbolsData) {
            watchlist.symbolsData = [];
        }

        // Add to both arrays for backward compatibility
        watchlist.symbols.push(symbolStr);

        // Store the full symbol data
        if (typeof symbolData === 'object') {
            watchlist.symbolsData.push({
                symbol: symbolData.symbol,
                name: symbolData.name || symbolData.symbol,
                exchange: symbolData.exchange || '',
                assetType: symbolData.assetType || symbolData.asset_type || 'Stock'
            });
        } else {
            // If only string was provided, create a minimal object
            watchlist.symbolsData.push({
                symbol: symbolStr,
                name: symbolStr,
                exchange: 'US',
                assetType: 'Stock'
            });
        }

        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        return watchlist.symbols;
    }

    async removeSymbol(watchlistName, symbol) {
        const watchlists = await this.getWatchlists();
        const watchlist = watchlists.find(w => w.name === watchlistName);

        if (!watchlist) {
            throw new Error('Watchlist not found');
        }

        const symbolIndex = watchlist.symbols.indexOf(symbol);
        if (symbolIndex === -1) {
            throw new Error('Symbol not found in watchlist');
        }

        // Remove from the symbols array
        watchlist.symbols.splice(symbolIndex, 1);

        // Also remove from symbolsData if it exists
        if (watchlist.symbolsData) {
            const dataIndex = watchlist.symbolsData.findIndex(item => item.symbol === symbol);
            if (dataIndex !== -1) {
                watchlist.symbolsData.splice(dataIndex, 1);
            }
        }

        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        return watchlist.symbols;
    }
}

export const watchlistService = new WatchlistService();