class IndicesWatchlistService {
    constructor() {
        this.storageKey = 'indicesWatchlists';
        this.initialized = false;
        this.listeners = new Set();
        this.watchlistsCache = null;
        
        // Listen for storage changes
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync' && changes[this.storageKey]) {
                    // Update our cache
                    this.watchlistsCache = changes[this.storageKey].newValue;
                    // Notify listeners with the new value
                    this.notifyListeners(changes[this.storageKey].newValue);
                }
            });
        }
    }

    addListener(callback) {
        this.listeners.add(callback);
        
        // If we already have data cached, immediately notify the new listener
        if (this.watchlistsCache) {
            // Use setTimeout to make this async and avoid potential issues
            setTimeout(() => {
                callback(this.watchlistsCache);
            }, 0);
        }
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(watchlists) {
        console.log('Notifying indices watchlist listeners with:', watchlists);
        this.listeners.forEach(callback => {
            try {
                callback(watchlists);
            } catch (error) {
                console.error('Error in indices watchlist listener:', error);
            }
        });
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
                this.watchlistsCache = [];
            } else {
                this.watchlistsCache = data[this.storageKey];
            }
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize indices watchlist storage:', error);
            throw new Error('Failed to initialize indices watchlist storage. Please check extension permissions.');
        }
    }

    async getWatchlists() {
        await this.initializeStorage();
        try {
            // If we have a cache, use it for faster response
            if (this.watchlistsCache) {
                return this.watchlistsCache;
            }
            
            const data = await chrome.storage.sync.get(this.storageKey);
            this.watchlistsCache = data[this.storageKey] || [];
            return this.watchlistsCache;
        } catch (error) {
            console.error('Failed to get indices watchlists:', error);
            return [];
        }
    }

    async createWatchlist(name) {
        const watchlists = await this.getWatchlists();
        if (watchlists.find(w => w.name === name)) {
            throw new Error('Indices watchlist with this name already exists');
        }

        const newWatchlist = {
            name,
            indices: [],
            created: Date.now()
        };

        watchlists.push(newWatchlist);
        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        
        // Update cache and notify listeners directly
        this.watchlistsCache = watchlists;
        this.notifyListeners(watchlists);
        
        return newWatchlist;
    }

    async renameWatchlist(oldName, newName) {
        const watchlists = await this.getWatchlists();
        const watchlist = watchlists.find(w => w.name === oldName);
        if (!watchlist) {
            throw new Error('Indices watchlist not found');
        }

        watchlist.name = newName;
        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        
        // Update cache and notify listeners directly
        this.watchlistsCache = watchlists;
        this.notifyListeners(watchlists);
        
        return watchlist;
    }

    async deleteWatchlist(name) {
        const watchlists = await this.getWatchlists();
        const updatedWatchlists = watchlists.filter(w => w.name !== name);
        await chrome.storage.sync.set({ [this.storageKey]: updatedWatchlists });
        
        // Update cache and notify listeners directly
        this.watchlistsCache = updatedWatchlists;
        this.notifyListeners(updatedWatchlists);
        
        return true;
    }

    async addIndex(watchlistName, indexData) {
        const watchlists = await this.getWatchlists();
        const watchlist = watchlists.find(w => w.name === watchlistName);

        if (!watchlist) {
            throw new Error('Indices watchlist not found');
        }

        // Handle both string and object formats for backward compatibility
        const indexSymbol = typeof indexData === 'string' ? indexData : indexData.symbol;

        // Check if the index already exists in the watchlist
        const existingIndex = watchlist.indicesData ?
            watchlist.indicesData.findIndex(item => item.symbol === indexSymbol) : -1;

        if (existingIndex >= 0 || watchlist.indices.includes(indexSymbol)) {
            throw new Error('Index already in watchlist');
        }

        // Initialize indicesData array if it doesn't exist
        if (!watchlist.indicesData) {
            watchlist.indicesData = [];
        }

        // Add to both arrays for backward compatibility
        watchlist.indices.push(indexSymbol);

        // Store the full index data
        if (typeof indexData === 'object') {
            watchlist.indicesData.push({
                symbol: indexData.symbol,
                name: indexData.name || indexData.symbol,
                exchange: indexData.exchange || '',
                assetType: 'Index'
            });
        } else {
            // If only string was provided, create a minimal object
            watchlist.indicesData.push({
                symbol: indexSymbol,
                name: indexSymbol,
                exchange: '',
                assetType: 'Index'
            });
        }

        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        
        // Update cache and notify listeners directly
        this.watchlistsCache = watchlists;
        this.notifyListeners(watchlists);
        
        return watchlist.indices;
    }

    async removeIndex(watchlistName, indexSymbol) {
        const watchlists = await this.getWatchlists();
        const watchlist = watchlists.find(w => w.name === watchlistName);

        if (!watchlist) {
            throw new Error('Indices watchlist not found');
        }

        const indexIdx = watchlist.indices.indexOf(indexSymbol);
        if (indexIdx === -1) {
            throw new Error('Index not found in watchlist');
        }

        // Remove from the indices array
        watchlist.indices.splice(indexIdx, 1);

        // Also remove from indicesData if it exists
        if (watchlist.indicesData) {
            const dataIndex = watchlist.indicesData.findIndex(item => item.symbol === indexSymbol);
            if (dataIndex !== -1) {
                watchlist.indicesData.splice(dataIndex, 1);
            }
        }

        await chrome.storage.sync.set({ [this.storageKey]: watchlists });
        
        // Update cache and notify listeners directly
        this.watchlistsCache = watchlists;
        this.notifyListeners(watchlists);
        
        return watchlist.indices;
    }
}

export const indicesWatchlistService = new IndicesWatchlistService();