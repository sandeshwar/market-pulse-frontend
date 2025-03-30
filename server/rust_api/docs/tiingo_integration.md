# Tiingo Market Data API Integration

This document provides a comprehensive guide to the Tiingo Market Data API integration in the Market Pulse application.

## Overview

The integration with Tiingo's Market Data API allows our application to:

1. Fetch real-time and end-of-day market data for stocks and ETFs
2. Access market indices data (via ETF proxies)
3. Efficiently cache and manage market data

## Setup and Configuration

### Prerequisites

1. A Tiingo account (free tier available)
2. API key from the Tiingo website

### Environment Variables

The following environment variables need to be set:

```
# Tiingo API Credentials
TIINGO_API_KEY=your_api_key

# Cache Configuration
MARKET_DATA_CACHE_DURATION=60  # Duration in seconds to cache market data
MARKET_DATA_STALE_THRESHOLD=300  # Time in seconds after which data is considered stale
MARKET_DATA_UPDATE_INTERVAL=60  # Interval in seconds for background updates
```

### Getting a Tiingo API Key

1. Sign up for a free account at [Tiingo](https://www.tiingo.com/)
2. Navigate to your account page
3. Generate an API key
4. Add the API key to your environment variables

## Architecture

The Tiingo integration consists of several components:

### 1. REST API Client (`TiingoClient`)

- Handles authentication with Tiingo API
- Makes HTTP requests to fetch market data
- Implements the `MarketDataProvider` trait
- Supports both IEX (real-time) and EOD (end-of-day) data

### 2. Market Data Service (`TiingoMarketDataService`)

- Manages caching of market data in Redis
- Handles background updates and data staleness
- Provides a unified interface for the application

## Usage

### Basic Usage

```rust
// Get the Tiingo market data service
let market_service = TiingoMarketDataService::new();

// Fetch price data for symbols
let symbols = vec!["AAPL".to_string(), "MSFT".to_string()];
let prices = market_service.get_symbol_prices(&symbols).await?;

// Fetch market indices (using ETF proxies)
let indices = vec!["SPY".to_string(), "QQQ".to_string()];
let indices_data = market_service.get_market_indices(&indices).await?;
```

## Symbol Format

Tiingo uses a simple format for symbols:

- Stocks: Standard ticker symbols (e.g., `AAPL`, `MSFT`)
- ETFs: Standard ticker symbols (e.g., `SPY`, `QQQ`)
- Indices: Represented by their ETF proxies:
  - S&P 500: `SPY`
  - NASDAQ-100: `QQQ`
  - Dow Jones Industrial Average: `DIA`

Our integration handles the formatting of these symbols automatically.

## Data Sources

Tiingo provides two main data sources:

1. **IEX (Real-time)**: Provides real-time data for US stocks and ETFs during market hours
2. **EOD (End-of-day)**: Provides daily data for a wider range of securities

Our implementation tries IEX first for real-time data, and falls back to EOD data if real-time data is not available.

## Error Handling

The integration provides comprehensive error handling:

- Connection failures with appropriate error messages
- Authentication errors with clear messages
- Data parsing errors with detailed information
- Fallback mechanisms when primary data sources are unavailable

All errors are properly logged and propagated through the `ApiError` type.

## Performance Considerations

1. **Caching**: Market data is cached in Redis to reduce API calls
2. **Batching**: Requests are batched to minimize API usage
3. **Background Updates**: Data is refreshed in the background
4. **Stale Data Management**: Unused data is automatically removed

## Limitations

1. Free tier is limited to 500 requests per day
2. Real-time data is only available for US markets
3. Some data may be delayed based on your Tiingo subscription level
4. Limited coverage for international markets

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Ensure your API key is correct
   - Check that you haven't exceeded your daily request limit

2. **Missing Data**
   - Ensure the symbols are in the correct format
   - Check if the market is open (real-time data is only available during market hours)
   - Verify that the security is covered by Tiingo

3. **Performance Issues**
   - Adjust cache duration settings
   - Batch requests more efficiently
   - Consider upgrading to a paid Tiingo plan for higher limits

### Logging

The integration uses the `tracing` crate for logging. Set the log level to `debug` for more detailed information:

```
RUST_LOG=market_pulse_api=debug,tiingo=debug
```

## Testing

We provide test scripts to verify the Tiingo integration:

1. **API Test**: Tests direct API calls to Tiingo
   ```bash
   cargo run --bin test_tiingo_api
   ```

2. **Service Test**: Tests the market data service with caching
   ```bash
   cargo run --bin test_tiingo_service
   ```

## Future Improvements

1. Add support for more Tiingo data endpoints (fundamentals, news)
2. Implement more sophisticated caching strategies
3. Add support for historical data retrieval
4. Enhance error recovery mechanisms
5. Add metrics and monitoring for API usage