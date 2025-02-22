const fs = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const Redis = require('redis');
const csvToJson = require('../utils/csvToJson');

class SymbolCache {
    constructor() {
        this.csvPath = path.join(__dirname, '../data/symbols.csv');
        this.redisClient = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        this.redisClient.on('error', (err) => console.error('Redis Client Error', err));
        this.isInitialized = false;
    }

    async connectToRedis() {
        if (!this.redisClient.isOpen) {
            try {
                await this.redisClient.connect();
                console.log('Connected to Redis successfully');
            } catch (error) {
                console.error('Failed to connect to Redis:', error);
                throw error;
            }
        }
    }

    async initializeCache() {
        if (this.isInitialized) {
            return;
        }

        try {
            // First connect to Redis
            await this.connectToRedis();
            
            // Always load fresh data from CSV first
            console.log('Loading initial data from CSV...');
            const jsonData = await csvToJson();
            
            if (!jsonData?.symbols || jsonData.symbols.length === 0) {
                throw new Error('No symbols found in CSV');
            }

            // Store in Redis
            await this.redisClient.set('symbols', JSON.stringify(jsonData));
            console.log('Cache initialized with', jsonData.symbols.length, 'symbols from CSV');
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize cache:', error);
            if (this.redisClient.isOpen) {
                await this.redisClient.set('symbols', JSON.stringify({ timestamp: Date.now(), symbols: [] }));
            }
            console.log('Initialized with empty cache due to error');
            this.isInitialized = true;
        }
    }

    async updateSymbols() {
        console.log('Updating symbols cache...');
        try {
            await this.connectToRedis();
            const jsonData = await csvToJson();
            
            if (!jsonData?.symbols || jsonData.symbols.length === 0) {
                throw new Error('No symbols found in CSV');
            }

            await this.redisClient.set('symbols', JSON.stringify(jsonData));
            console.log(`Symbols cache updated with ${jsonData.symbols.length} symbols`);
        } catch (error) {
            console.error('Failed to update symbols:', error);
        }
    }

    async searchSymbols(query) {
        console.log('Searching symbols for query:', query);
        if (!this.isInitialized) {
            await this.initializeCache();
        }

        try {
            await this.connectToRedis();
            const cachedData = await this.redisClient.get('symbols');
            if (!cachedData) {
                console.log('No symbols in Redis cache');
                return [];
            }

            const parsedData = JSON.parse(cachedData);
            if (!parsedData?.symbols) {
                console.log('No symbols in parsed cache data');
                return [];
            }

            const upperQuery = query.toUpperCase();
            return parsedData.symbols
                .filter(item =>
                    item.symbol.includes(upperQuery) ||
                    item.name.toUpperCase().includes(upperQuery)
                )
                .slice(0, 10);
        } catch (error) {
            console.error('Error searching symbols:', error);
            return [];
        }
    }

    async cleanup() {
        if (this.redisClient.isOpen) {
            await this.redisClient.quit();
        }
    }
}

// Create singleton instance
const symbolCache = new SymbolCache();

// Initialize cache asynchronously
(async () => {
    try {
        console.log('Initializing symbol cache');
        await symbolCache.initializeCache();
    } catch (error) {
        console.error('Failed to initialize symbol cache:', error);
    }
})();

// Update cache every day at midnight
cron.schedule('0 0 * * *', async () => {
    try {
        await symbolCache.updateSymbols();
        console.log('Scheduled cache update triggered');
    } catch (error) {
        console.error('Scheduled cache update failed:', error);
    }
});

// Cleanup on process exit
process.on('SIGTERM', async () => {
    await symbolCache.cleanup();
});

process.on('SIGINT', async () => {
    await symbolCache.cleanup();
});

module.exports = symbolCache;