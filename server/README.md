# Market Pulse Backend API

Backend API for Market Pulse - Indices watchlist and data scraping service.

## Features

- **Express server** on port 3001 with Chrome extension CORS support
- **Memory storage** for real-time indices data
- **Puppeteer scraper** for investing.com with fallback selectors
- **Seed data** with 15 major global indices for reliability
- **Comprehensive API endpoints** matching frontend requirements
- **Robust error handling** with exponential backoff and retry logic

## Quick Start

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Server endpoints:**
   - Health check: http://localhost:3001/api/health
   - All indices: http://localhost:3001/api/market-data/indices/all
   - Search indices: http://localhost:3001/api/market-data/indices/search?q=S&P
   - Individual index: http://localhost:3001/api/market-data/indices/S&P-500

## API Endpoints

### GET /api/health
Returns server and scraper status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-01T07:02:24.646Z",
  "scraper": {
    "status": "success",
    "indicesCount": 14,
    "lastUpdated": 1698796800000,
    "successRate": "100.00%"
  },
  "uptime": 4.464916
}
```

### GET /api/market-data/indices/all
Returns all available indices with current data.

**Response:**
```json
{
  "prices": {
    "S&P-500": {
      "price": 4502.88,
      "change": 23.45,
      "percent_change": 0.52,
      "additional_data": {
        "name": "S&P 500",
        "exchange": "NYSE",
        "lastUpdated": 1698796800000
      }
    }
  },
  "metadata": {
    "lastUpdated": 1698796800000,
    "status": "success",
    "count": 14
  }
}
```

### GET /api/market-data/indices/search?q=query
Search indices by symbol or name.

**Parameters:**
- `q` (required): Search query string

**Response:**
```json
{
  "query": "S&P",
  "results": [
    {
      "symbol": "S&P-500",
      "name": "S&P 500",
      "exchange": "NYSE",
      "price": 4502.88,
      "change": 23.45,
      "percent_change": 0.52
    }
  ],
  "count": 1
}
```

### GET /api/market-data/indices/:symbol
Get specific index data by symbol.

**Response:**
```json
{
  "symbol": "S&P-500",
  "price": 4502.88,
  "change": 23.45,
  "percent_change": 0.52,
  "additional_data": {
    "name": "S&P 500",
    "exchange": "NYSE",
    "lastUpdated": 1698796800000
  }
}
```

## Data Sources

### Seed Data
The server loads static data for 15 major global indices on startup from `seedData.json`. This ensures the API works immediately even if scraping fails.

**Available indices:**
- S&P 500, NASDAQ 100, Dow Jones (US)
- FTSE 100, DAX, CAC 40 (Europe)
- Nikkei 225, Shanghai Composite, Hang Seng (Asia)
- And more...

### Web Scraping
The scraper attempts to fetch real-time data from https://in.investing.com/indices/major-indices every 90 seconds.

**Features:**
- Multiple selector strategies with fallbacks
- Exponential backoff on failures
- Browser restart to prevent memory leaks
- Screenshot debugging on failures

## Known Issues

- **Puppeteer crashes** on macOS ARM due to compatibility issues with version 21.11.0
- **Scraping may fail** but seed data provides reliable fallback
- **Background retries** continue but don't affect API functionality

## Development

### Scripts
- `npm start` - Start production server
- `npm dev` - Start with file watching for development

### Environment Variables
- `PORT` - Server port (default: 3001)

### Logging
- All logs output to console
- Screenshots saved to server root on scraping failures
- Check health endpoint for scraper status

## Troubleshooting

**Server won't start:**
- Check if port 3001 is available
- Verify all dependencies installed with `npm install`

**API returns empty data:**
- Check health endpoint for scraper status
- Seed data should load automatically on startup
- Restart server if seed data failed to load

**Scraping issues:**
- Puppeteer may crash on some systems (especially macOS ARM)
- API continues working with seed data
- Screenshots saved as `debug-*.png` for analysis

**CORS errors:**
- Ensure frontend is running on localhost or as Chrome extension
- Check browser console for specific error messages

## Architecture

```
server/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── seedData.json          # Static indices data
├── scraper/
│   ├── indexManager.js    # Data storage and management
│   └── indexScraper.js    # Puppeteer web scraper
└── routes/
    └── indices.js         # API route handlers
```

## Next Steps

1. **Frontend Integration** - Connect Chrome extension to backend API
2. **Fix Scraping** - Update Puppeteer version or switch to axios/cheerio
3. **Add Rate Limiting** - Prevent API abuse
4. **File Logging** - Persist logs for debugging
5. **Data Validation** - Add input validation and error handling
