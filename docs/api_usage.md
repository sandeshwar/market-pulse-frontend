# Market Pulse API Usage Guide

This document provides guidelines for using the Market Pulse API in the frontend application.

## API Endpoints

The Market Pulse API provides separate endpoints for stocks and indices to ensure clear separation of concerns.

### Stock Data

Use the dedicated stocks endpoint for all stock-related data:

```javascript
// Example: Fetching stock data
const response = await fetch(`${config.API_URL}market-data/stocks?symbols=AAPL,MSFT,GOOGL`);
```

This endpoint will only process valid stock symbols and will reject any index symbols.

### Market Indices

Use the dedicated indices endpoint for all market index data:

```javascript
// Example: Fetching market indices
const response = await fetch(`${config.API_URL}market-data/indices`);
```

This endpoint will only process valid index symbols and will reject any stock symbols.

## Frontend Services

The frontend services have been updated to use the appropriate endpoints:

- `MarketDataAppProvider.getStocks()` - Uses the stocks endpoint for individual stock quotes
- `MarketDataAppProvider.getMarketIndices()` - Uses the indices endpoint for market indices

## Best Practices

1. **Use the Right Endpoint**: Always use the dedicated endpoint for the type of data you need.
2. **Handle Errors**: The API will return appropriate error messages if you try to use the wrong endpoint.
3. **Check Symbol Validity**: Ensure that symbols are valid before sending them to the API.



## Available Market Indices

The following market indices are supported:

- SPX (S&P 500)
- DJI (Dow Jones Industrial Average)
- IXIC (NASDAQ Composite)
- NDX (NASDAQ 100)
- RUT (Russell 2000)
- VIX (CBOE Volatility Index)
- FTSE (FTSE 100)
- DAX (DAX)
- CAC (CAC 40)
- STOXX50E (Euro Stoxx 50)
- N225 (Nikkei 225)
- HSI (Hang Seng)
- SSEC (Shanghai Composite)
- SENSEX (BSE SENSEX)
- NIFTY (NIFTY 50)

## Implementation Details

The API uses the Wall Street Journal (WSJ) as the data provider for market indices. This is separate from the Tiingo provider used for stock data.

The WSJ provider:
- Fetches real-time market index data directly from the Wall Street Journal website
- Provides accurate and up-to-date information for major global indices
- Handles the mapping between standard index symbols (e.g., SPX, DJI) and their display names

The backend also supports an alternative Google Finance provider that can be configured if needed.

Note: Unlike stock data which comes from Tiingo, market indices data comes from a completely separate data source optimized for index information.