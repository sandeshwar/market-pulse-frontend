class IndicesWatchlistService {
    constructor() {
        this.storageKey = 'indices_watchlists';
        this.initialized = false;
        this.listeners = new Set();
        this.watchlistsCache = null;
        this.initializationPromise = null;
        this.operationInProgress = false;
        
        // Listen for storage changes
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync' && changes[this.storageKey]) {
                    console.log('Chrome storage changed for indices_watchlists:', 
                        JSON.stringify(changes[this.storageKey].newValue));
                    
                    // Update our cache with a deep copy to avoid reference issues
                    if (changes[this.storageKey].newValue) {
                        try {
                            // Create a deep copy to avoid reference issues
                            this.watchlistsCache = JSON.parse(JSON.stringify(changes[this.storageKey].newValue));
                            
                            // Notify listeners with the new value
                            this.notifyListeners(this.watchlistsCache);
                        } catch (error) {
                            console.error('Error processing storage change:', error);
                        }
                    } else {
                        console.warn('Received null or undefined value from storage change');
                        this.watchlistsCache = [];
                        this.notifyListeners(this.watchlistsCache);
                    }
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
        console.log('Notifying indices watchlist listeners with:', JSON.stringify(watchlists));
        
        // Make sure we have valid data to notify about
        if (!watchlists || !Array.isArray(watchlists)) {
            console.warn('Invalid watchlists data for notification:', watchlists);
            watchlists = [];
        }
        
        // Create a deep copy to avoid reference issues
        const watchlistsCopy = JSON.parse(JSON.stringify(watchlists));
        
        // Notify each listener with the copied data
        this.listeners.forEach(callback => {
            try {
                // Use setTimeout to ensure this runs asynchronously
                setTimeout(() => {
                    callback(watchlistsCopy);
                }, 0);
            } catch (error) {
                console.error('Error in indices watchlist listener:', error);
            }
        });
    }

    async initializeStorage() {
        // If already initialized, return immediately
        if (this.initialized) return;
        
        // If initialization is in progress, wait for it to complete
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        // Start initialization and store the promise
        this.initializationPromise = (async () => {
            try {
                // Check if we're in a Chrome extension context
                if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
                    throw new Error('Chrome extension storage is not available');
                }
    
                const data = await chrome.storage.sync.get(this.storageKey);
                if (!data[this.storageKey]) {
                    await chrome.storage.sync.set({ [this.storageKey]: [] });
                    // Create a deep copy to avoid reference issues
                    this.watchlistsCache = [];
                } else {
                    // Create a deep copy to avoid reference issues
                    this.watchlistsCache = JSON.parse(JSON.stringify(data[this.storageKey]));
                }
                this.initialized = true;
                return this.watchlistsCache;
            } catch (error) {
                console.error('Failed to initialize indices watchlist storage:', error);
                // Reset initialization state so it can be retried
                this.initializationPromise = null;
                throw new Error('Failed to initialize indices watchlist storage. Please check extension permissions.');
            }
        })();
        
        return this.initializationPromise;
    }

    async getWatchlists() {
        // Ensure storage is initialized
        await this.initializeStorage();
        
        try {
            // If we have a cache and no operation is in progress, use it for faster response
            if (this.watchlistsCache && !this.operationInProgress) {
                // Return a deep copy to avoid reference issues
                return JSON.parse(JSON.stringify(this.watchlistsCache));
            }
            
            // Otherwise, get fresh data from storage
            const data = await chrome.storage.sync.get(this.storageKey);
            
            // Update cache with a deep copy
            this.watchlistsCache = JSON.parse(JSON.stringify(data[this.storageKey] || []));
            
            // Return a deep copy to avoid reference issues
            return JSON.parse(JSON.stringify(this.watchlistsCache));
        } catch (error) {
            console.error('Failed to get indices watchlists:', error);
            // Return empty array in case of error
            return [];
        }
    }

    async createWatchlist(name) {
        // Set operation flag to prevent cache usage during this operation
        if (this.operationInProgress) {
            console.warn('Another operation is in progress, waiting...');
            // Wait for a small delay to avoid tight loops
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.createWatchlist(name);
        }
        
        this.operationInProgress = true;
        
        try {
            // Always get fresh data for modifications
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
            
            // Save to Chrome storage
            await chrome.storage.sync.set({ [this.storageKey]: watchlists });
            
            // Update cache with a deep copy
            this.watchlistsCache = JSON.parse(JSON.stringify(watchlists));
            
            // Notify listeners with a deep copy
            this.notifyListeners(this.watchlistsCache);
            
            // Return a deep copy of the new watchlist
            return JSON.parse(JSON.stringify(newWatchlist));
        } catch (error) {
            console.error('Error creating watchlist:', error);
            throw error;
        } finally {
            // Reset operation flag
            this.operationInProgress = false;
        }
    }

    async renameWatchlist(oldName, newName) {
        // Set operation flag to prevent cache usage during this operation
        if (this.operationInProgress) {
            console.warn('Another operation is in progress, waiting...');
            // Wait for a small delay to avoid tight loops
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.renameWatchlist(oldName, newName);
        }
        
        this.operationInProgress = true;
        
        try {
            // Always get fresh data for modifications
            const watchlists = await this.getWatchlists();
            
            const watchlist = watchlists.find(w => w.name === oldName);
            if (!watchlist) {
                throw new Error('Indices watchlist not found');
            }
    
            // Check if the new name already exists
            if (watchlists.find(w => w.name === newName && w.name !== oldName)) {
                throw new Error('A watchlist with this name already exists');
            }
    
            watchlist.name = newName;
            
            // Save to Chrome storage
            await chrome.storage.sync.set({ [this.storageKey]: watchlists });
            
            // Update cache with a deep copy
            this.watchlistsCache = JSON.parse(JSON.stringify(watchlists));
            
            // Notify listeners with a deep copy
            this.notifyListeners(this.watchlistsCache);
            
            // Return a deep copy of the renamed watchlist
            return JSON.parse(JSON.stringify(watchlist));
        } catch (error) {
            console.error('Error renaming watchlist:', error);
            throw error;
        } finally {
            // Reset operation flag
            this.operationInProgress = false;
        }
    }

    async deleteWatchlist(name) {
        // Set operation flag to prevent cache usage during this operation
        if (this.operationInProgress) {
            console.warn('Another operation is in progress, waiting...');
            // Wait for a small delay to avoid tight loops
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.deleteWatchlist(name);
        }
        
        this.operationInProgress = true;
        
        try {
            // Always get fresh data for modifications
            const watchlists = await this.getWatchlists();
            
            // Check if the watchlist exists
            if (!watchlists.some(w => w.name === name)) {
                throw new Error('Indices watchlist not found');
            }
            
            const updatedWatchlists = watchlists.filter(w => w.name !== name);
            
            // Save to Chrome storage
            await chrome.storage.sync.set({ [this.storageKey]: updatedWatchlists });
            
            // Update cache with a deep copy
            this.watchlistsCache = JSON.parse(JSON.stringify(updatedWatchlists));
            
            // Notify listeners with a deep copy
            this.notifyListeners(this.watchlistsCache);
            
            return true;
        } catch (error) {
            console.error('Error deleting watchlist:', error);
            throw error;
        } finally {
            // Reset operation flag
            this.operationInProgress = false;
        }
    }

    async addIndex(watchlistName, indexData) {
        // Set operation flag to prevent cache usage during this operation
        if (this.operationInProgress) {
            console.warn('Another operation is in progress, waiting...');
            // Wait for a small delay to avoid tight loops
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.addIndex(watchlistName, indexData);
        }
        
        this.operationInProgress = true;
        
        try {
            // Always get fresh data for modifications
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
    
            // Log the watchlist before saving for debugging
            console.log('Saving updated indices watchlist:', JSON.stringify(watchlists));
            
            // Save to Chrome storage
            await chrome.storage.sync.set({ [this.storageKey]: watchlists });
            
            // Update cache with a deep copy
            this.watchlistsCache = JSON.parse(JSON.stringify(watchlists));
            
            // Notify listeners with a deep copy
            this.notifyListeners(this.watchlistsCache);
            
            console.log('Successfully saved and notified about indices watchlist update');
            
            // Return a deep copy of the indices array
            return JSON.parse(JSON.stringify(watchlist.indices));
        } catch (error) {
            console.error('Error saving indices watchlist:', error);
            throw error;
        } finally {
            // Reset operation flag
            this.operationInProgress = false;
        }
    }

    async removeIndex(watchlistName, indexSymbol) {
        // Set operation flag to prevent cache usage during this operation
        if (this.operationInProgress) {
            console.warn('Another operation is in progress, waiting...');
            // Wait for a small delay to avoid tight loops
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.removeIndex(watchlistName, indexSymbol);
        }
        
        this.operationInProgress = true;
        
        try {
            // Always get fresh data for modifications
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
    
            // Log the watchlist before saving for debugging
            console.log('Saving updated indices watchlist after removal:', JSON.stringify(watchlists));
            
            // Save to Chrome storage
            await chrome.storage.sync.set({ [this.storageKey]: watchlists });
            
            // Update cache with a deep copy
            this.watchlistsCache = JSON.parse(JSON.stringify(watchlists));
            
            // Notify listeners with a deep copy
            this.notifyListeners(this.watchlistsCache);
            
            console.log('Successfully saved and notified about indices watchlist update after removal');
            
            // Return a deep copy of the indices array
            return JSON.parse(JSON.stringify(watchlist.indices));
        } catch (error) {
            console.error('Error saving indices watchlist after removal:', error);
            throw error;
        } finally {
            // Reset operation flag
            this.operationInProgress = false;
        }
    }
}

export const indicesWatchlistService = new IndicesWatchlistService();