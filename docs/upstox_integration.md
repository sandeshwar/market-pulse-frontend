# Upstox API Integration

This document describes how to use the Upstox API integration for tracking Indian stocks (NSE) in Market Pulse.

## Overview

The Upstox API integration allows users to add and track Indian stocks (NSE) from their watchlist. 

## Configuration

1. Obtain an API key from Upstox by registering as a developer at [Upstox Developer Portal](https://upstox.com/developer/).

2. Add your Upstox API key to the `.env` file in the `server/rust_api` directory:

```
# Upstox API configuration
UPSTOX_API_KEY=your_upstox_api_key_here
```

## Usage

### Adding Indian Stocks to Watchlist

When adding a stock to a watchlist, you can specify that it's an Indian stock by setting the `market` field to `NSE`:

```javascript
await watchlistService.addSymbol('My Watchlist', {
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd',
  exchange: 'NSE',
  assetType: 'Stock',
  market: 'NSE'
});
```

### API Endpoints

The following API endpoints are available for Indian stocks:

- `GET /api/market-data/indian-stocks?symbols=RELIANCE,INFY,TCS` - Get price data for Indian stocks

### Implementation Details

The integration works by:

1. Adding a new `market` field to the watchlist symbol data to identify Indian stocks.
2. Creating a new Upstox client implementation in `upstox.rs` that handles fetching market data from Upstox API.
3. Creating a new Upstox market data service in `upstox_market_data.rs` that handles caching and background updates.
4. Adding a new API endpoint for Indian stocks.
5. Updating the MarketDataAppProvider to handle both US and Indian stocks.

## Symbol Format

For NSE stocks, the Upstox API requires symbols to be in the format `NSE_EQ:SYMBOL`. For example, to get data for Reliance Industries, the symbol should be `NSE_EQ:RELIANCE`.

The integration handles this conversion automatically, so you can just use the symbol name (e.g., `RELIANCE`) when adding it to your watchlist.

## Limitations

- The Upstox API has rate limits. Please refer to the [Upstox API documentation](https://upstox.com/developer/api-documentation/rate-limiting) for details.
- The integration currently only supports NSE stocks. BSE stocks may be added in the future.