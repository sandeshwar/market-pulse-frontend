import express from 'express';
import cors from 'cors';
import { IndexManager } from './scraper/indexManager.js';
import { IndexScraper } from './scraper/indexScraper.js';
import indicesRoutes from './routes/indices.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const DISABLE_SCRAPING = process.env.DISABLE_SCRAPING === 'true';

// CORS configuration for Chrome extension
const corsOptions = {
  origin: true, // Temporarily allow all origins for testing
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Initialize index manager and scraper
const indexManager = new IndexManager();
const indexScraper = new IndexScraper();

// Load seed data on startup
function loadSeedData() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const seedDataPath = join(__dirname, 'seedData.json');
    const seedData = JSON.parse(readFileSync(seedDataPath, 'utf8'));
    
    console.log('📊 Loading seed data...');
    
    // Convert seed data to the format expected by IndexManager
    const now = Date.now();
    const indicesData = Object.entries(seedData.prices).map(([symbol, data]) => ({
      symbol,
      name: data.additional_data.name,
      price: data.price,
      change: data.change,
      percent_change: data.percent_change,
      exchange: data.additional_data.exchange
    }));
    
    indexManager.updateIndices(indicesData);
    console.log(`✅ Loaded ${indicesData.length} indices from seed data`);
  } catch (error) {
    console.error('❌ Failed to load seed data:', error);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const status = indexManager.getStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    scraper: status,
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/market-data', indicesRoutes(indexManager));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize scraper and start periodic updates
async function initializeServer() {
  try {
    console.log('🚀 Starting Market Pulse Backend Server...');
    
    // Load seed data first to ensure API works immediately
    loadSeedData();
    
    // Skip scraping if disabled
    if (DISABLE_SCRAPING) {
      console.log('📊 Scraping disabled - using seed data only');
    } else {
      // Start initial scrape in background (don't block server startup)
      console.log('📊 Starting initial data scrape in background...');
      indexScraper.scrapeIndices(indexManager).catch(error => {
        console.error('❌ Initial scrape failed:', error);
      });
    
      // Schedule periodic scraping every 90 seconds using setInterval
      let scrapeInterval = 90000; // 90 seconds
      let consecutiveFailures = 0;
      let scrapeIntervalId = null;
      
      // Define the scrape function that will be called periodically
      const performScrape = async () => {
        try {
          console.log('🔄 Scheduled scrape running...');
          await indexScraper.scrapeIndices(indexManager);
          consecutiveFailures = 0; // Reset on success
          
          // Reset interval to normal on success
          if (scrapeInterval > 90000) {
            scrapeInterval = 90000;
            clearInterval(scrapeIntervalId);
            scrapeIntervalId = setInterval(performScrape, scrapeInterval);
            console.log(`✅ Reset scrape interval to ${scrapeInterval / 1000}s`);
          }
        } catch (error) {
          console.error('❌ Scheduled scrape failed:', error);
          consecutiveFailures++;
          
          // Implement exponential backoff
          if (consecutiveFailures > 2) {
            scrapeInterval = Math.min(scrapeInterval * 2, 300000); // Max 5 minutes
            console.log(`⏰ Increasing scrape interval to ${scrapeInterval / 1000}s due to failures`);
            
            // Reschedule with new interval
            clearInterval(scrapeIntervalId);
            scrapeIntervalId = setInterval(performScrape, scrapeInterval);
          }
        }
      };
      
      // Start the initial interval
      scrapeIntervalId = setInterval(performScrape, scrapeInterval);
    }
    
    console.log('✅ Server initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    // Don't exit the process, let the server start anyway
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📈 Indices API: http://localhost:${PORT}/api/market-data/indices/all`);
  
  await initializeServer();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

export default app;
