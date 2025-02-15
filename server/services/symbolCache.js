const fs = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const csvToJson = require('../utils/csvToJson');


class SymbolCache {
    constructor() {
        this.symbolsPath = path.join(__dirname, '../data/symbols.json');
        this.memoryCache = null;
        this.lastUpdate = 0;
        this.updateInterval = 24 * 60 * 60 * 1000; // 24 hours
    }

    async initializeCache() {
        try {
            console.log('Initializing cache from disk...');
            const data = await fs.readFile(this.symbolsPath, 'utf-8');
            this.memoryCache = JSON.parse(data);
            this.lastUpdate = this.memoryCache.timestamp;
            console.log('Cache initialized successfully from disk', this.memoryCache.symbols.length);
        } catch (error) {
            console.error('Failed to load symbols cache:', error);
            this.memoryCache = { timestamp: 0, symbols: [] };
            console.log('Initialized with empty cache due to error');
        }
    }

    async updateSymbols() {
        console.log('Updating symbols cache...');
        try {
            if (process.env.USE_LOCAL_CSV === 'true') {
                await this.updateFromLocalCSV();
            } else {
                await this.updateFromAPI();
            }
            console.log(`Symbols cache updated with ${this.memoryCache?.symbols?.length} symbols`);
        } catch (error) {
            console.error('Failed to update symbols:', error);
        }
    }

    async updateFromLocalCSV() {
        console.log('Updating symbols cache from local CSV...');
        try {
            const jsonData = await csvToJson();
            this.memoryCache = jsonData;
            console.log('Symbols cache updated from local csv');
        } catch (error) {
            console.error('Error updating from local CSV:', error);
        }
    }

    async updateFromAPI() {
        console.log('Updating symbols cache from API...');
        const maxRetries = 2;
        let retries = 0;
        let response = null;
        let lastError = null;

        while (retries < maxRetries) {
            try {
                response = await fetch(
                    `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${process.env.ALPHA_VANTAGE_KEY}&state=active`
                );
                if (response.ok) {
                    break; // Successful response, exit retry loop
                } else {
                    lastError = new Error(`HTTP error! status: ${response.status}`);
                    console.warn(`API request failed with status ${response.status}, retrying... (${retries + 1}/${maxRetries})`);
                }
            } catch (error) {
                lastError = error;
                console.error(`Fetch error, retrying... (${retries + 1}/${maxRetries}):`, error);
            }
            retries++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
        }

        if (!response?.ok) {
            console.error('Failed to fetch data from Alpha Vantage after multiple retries:', lastError);
            return; // Stop updating if all retries failed
        }

        try {
            const jsonData = await response.json();
            await this.processAPIResponse(jsonData);
        } catch (jsonError) {
            console.error('Error parsing JSON response:', jsonError);
        }
    }

    async processAPIResponse(jsonData) {
        if (jsonData && Array.isArray(jsonData.symbols)) {
            const symbols = jsonData.symbols.map(item => ({
                symbol: item.symbol,
                name: item.name,
                exchange: item.exchange,
                type: item.assetType
            }));
            this.memoryCache.symbols = symbols;
            this.memoryCache.timestamp = Date.now();
            await fs.writeFile(this.symbolsPath, JSON.stringify(this.memoryCache));
            console.log(`Updated symbols cache with ${symbols.length} symbols from JSON`);
        } else {
            console.warn('JSON response does not contain expected symbols array.');
            console.log('Full JSON response:', jsonData);
        }
    }

    searchSymbols(query) {
        if (!this.memoryCache?.symbols) {
            console.log('No symbols in memory cache');
            return [];
        }

        const upperQuery = query.toUpperCase();
        return this.memoryCache.symbols
            .filter(item =>
                item.symbol.includes(upperQuery) ||
                item.name.toUpperCase().includes(upperQuery)
            )
            .slice(0, 10);
    }
}

// Singleton instance
const symbolCache = new SymbolCache();

// Initialize on startup
console.log('Initializing symbol cache');
symbolCache.initializeCache();
if (!symbolCache.memoryCache?.symbols || symbolCache.memoryCache.symbols.length === 0) {
    symbolCache.updateSymbols(); // Force update on startup
}

// Update cache every day at midnight
cron.schedule('0 0 * * *', () => {
    symbolCache.updateSymbols();
    console.log('Scheduled cache update triggered');
});

module.exports = symbolCache; 