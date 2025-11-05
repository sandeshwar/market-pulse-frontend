import express from 'express';
import cors from 'cors';
import { IndexManager } from './scraper/indexManager.js';
import { IndexScraper } from './scraper/indexScraper.js';
import indicesRoutes from './routes/indices.js';

const app = express();
const PORT = process.env.PORT || 3001;
const DISABLE_SCRAPING = process.env.DISABLE_SCRAPING === 'true';
const MIN_API_INTERVAL_MS = Number(process.env.MIN_API_INTERVAL_MS || 1000);

// CORS configuration for Chrome extension
const corsOptions = {
  origin: true, // Temporarily allow all origins for testing
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use((req, res, next) => {
  const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  req.id = rid;
  res.setHeader('X-Request-Id', rid);
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setTimeout(15000, () => {
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Request timeout',
        message: 'The server took too long to respond',
        request_id: req.id
      });
    }
  });
  next();
});

const lastRequestByIP = new Map();
function minIntervalLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const last = lastRequestByIP.get(ip) || 0;
  const elapsed = now - last;
  if (elapsed < MIN_API_INTERVAL_MS) {
    const wait = MIN_API_INTERVAL_MS - elapsed;
    setTimeout(() => {
      lastRequestByIP.set(ip, Date.now());
      next();
    }, wait);
    return;
  }
  lastRequestByIP.set(ip, now);
  next();
}

// Initialize index manager and scraper
const indexManager = new IndexManager();
const indexScraper = new IndexScraper();

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
app.use('/api/market-data', minIntervalLimiter, indicesRoutes(indexManager));

// Error handling middleware
app.use((err, req, res, next) => {
  const isJsonSyntaxError = err instanceof SyntaxError && 'body' in err;
  const status = err.status || err.statusCode || (isJsonSyntaxError ? 400 : 500);
  const isDev = process.env.NODE_ENV === 'development';
  const payload = {
    error: status === 400 ? 'Bad request' : 'Internal server error',
    message: isDev ? err.message : (isJsonSyntaxError ? 'Malformed JSON payload' : 'Something went wrong'),
    request_id: req.id
  };
  if (isDev && err.stack) {
    payload.stack = err.stack;
  }
  console.error(`[${req?.id || '-'}]`, 'Server error:', err);
  if (res.headersSent) return next(err);
  res.status(status).json(payload);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
    request_id: req.id
  });
});

// Initialize scraper and start periodic updates
async function initializeServer() {
  try {
    console.log('🚀 Starting Market Pulse Backend Server...');
    
    // Initialize scraper - no seed data fallback
    if (DISABLE_SCRAPING) {
      console.log('📊 Scraping disabled');
      return;
    }
    
    try {
      console.log('📊 Initializing scraper for live data...');
      await indexScraper.initialize();
      console.log('✅ Scraper initialized successfully');
      
      // Start initial scrape
      console.log('📊 Starting initial data scrape...');
      await indexScraper.scrapeIndices(indexManager);
      
      // Schedule periodic scraping
      const scrapeInterval = Number(process.env.SCRAPE_INTERVAL_MS || 15000);
      setInterval(async () => {
        try {
          console.log('🔄 Scheduled scrape running...');
          await indexScraper.scrapeIndices(indexManager);
        } catch (error) {
          console.error('❌ Scheduled scrape failed:', error);
        }
      }, scrapeInterval);
      
    } catch (scraperError) {
      console.error('❌ Scraper initialization failed:', scraperError.message);
      // Server will continue but API endpoints will return 503 when data is requested
    }
    
    console.log('✅ Server initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
  }
}

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📈 Indices API: http://localhost:${PORT}/api/market-data/indices/all`);
  
  await initializeServer();
});

server.setTimeout(20000);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const shutdown = async (signal) => {
  console.log(`\n🛑 Shutting down server (${signal})...`);
  try {
    await indexScraper.close();
  } catch (e) {
    console.error('Error closing scraper during shutdown:', e);
  }
  try {
    server.close(() => {
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err);
});

 

export default app;
