const fs = require('fs/promises');
const path = require('path');
const cron = require('node-cron');

class SymbolCache {
    constructor() {
        this.symbolsPath = path.join(__dirname, '../data/symbols.json');
        this.memoryCache = null;
        this.lastUpdate = 0;
        this.updateInterval = 24 * 60 * 60 * 1000; // 24 hours
    }

    async initializeCache() {
        try {
            const data = await fs.readFile(this.symbolsPath, 'utf-8');
            this.memoryCache = JSON.parse(data);
            this.lastUpdate = this.memoryCache.timestamp;
        } catch (error) {
            console.error('Failed to load symbols cache:', error);
            this.memoryCache = { timestamp: 0, symbols: [] };
        }
    }

    async updateSymbols() {
        try {
            const response = await fetch(
                `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${process.env.ALPHA_VANTAGE_KEY}&state=active`
            );
            const csv = await response.text();
            
            const symbols = csv.split('\n')
                .slice(1)
                .map(line => {
                    const [symbol, name, exchange, assetType] = line.split(',');
                    return { symbol, name, exchange, type: assetType };
                })
                .filter(item => item.symbol);

            this.memoryCache = {
                timestamp: Date.now(),
                symbols
            };

            // Save to disk
            await fs.writeFile(
                this.symbolsPath, 
                JSON.stringify(this.memoryCache),
                'utf-8'
            );

            console.log(`Updated symbols cache with ${symbols.length} symbols`);
        } catch (error) {
            console.error('Failed to update symbols:', error);
        }
    }

    searchSymbols(query) {
        if (!this.memoryCache?.symbols) return [];
        
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

// Update cache every day at midnight
cron.schedule('0 0 * * *', () => {
    symbolCache.updateSymbols();
});

module.exports = symbolCache; 