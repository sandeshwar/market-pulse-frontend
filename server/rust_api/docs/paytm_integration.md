# Paytm Money Market Data API Integration

This document provides a comprehensive guide to the Paytm Money Market Data API integration in the Market Pulse application.

## Overview

The integration with Paytm Money's Market Data API allows our application to:

1. Fetch real-time market data for stocks, ETFs, and indices
2. Stream live market data updates via WebSocket
3. Efficiently cache and manage market data

## Setup and Configuration

### Prerequisites

1. A Paytm Money account with API access
2. API key and secret from the Paytm Money Developer Portal
3. Access tokens generated using the provided script

### Environment Variables

The following environment variables need to be set:

```
# Paytm API Credentials
PAYTM_API_KEY=your_api_key
PAYTM_ACCESS_TOKEN=your_access_token
PAYTM_PUBLIC_ACCESS_TOKEN=your_public_access_token

# Optional: WebSocket Configuration
PAYTM_USE_WEBSOCKET=true  # Set to true to enable WebSocket streaming

# Cache Configuration
MARKET_DATA_CACHE_DURATION=60  # Duration in seconds to cache market data
MARKET_DATA_STALE_THRESHOLD=300  # Time in seconds after which data is considered stale
MARKET_DATA_UPDATE_INTERVAL=60  # Interval in seconds for background updates
```

### Generating Access Tokens

We provide a utility script to generate the required access tokens:

```bash
cargo run --bin generate_paytm_tokens
```

This script will:
1. Prompt for your API key (or use the one from environment variables)
2. Generate a login URL for Paytm Money authentication
3. Extract the request token from the redirect URL
4. Exchange it for access tokens
5. Display the tokens to add to your environment

## Architecture

The Paytm integration consists of several components:

### 1. REST API Client (`PaytmMoneyClient`)

- Handles authentication with Paytm Money API
- Makes HTTP requests to fetch market data
- Implements the `MarketDataProvider` trait

### 2. WebSocket Client (`PaytmWebSocketClient`)

- Establishes and maintains a WebSocket connection for real-time data
- Handles authentication and subscription management
- Implements the `RealTimeMarketDataProvider` trait
- Provides a channel for receiving real-time updates

### 3. Market Data Service

- Coordinates between the REST and WebSocket clients
- Manages caching of market data in Redis
- Handles background updates and data staleness
- Provides a unified interface for the application

## Usage

### Basic Usage

```rust
// Get the market data service
let market_service = MarketDataService::new();

// Fetch price data for symbols
let symbols = vec!["RELIANCE.NSE".to_string(), "INFY.NSE".to_string()];
let prices = market_service.get_symbol_prices(&symbols).await?;

// Fetch market indices
let indices = vec!["NIFTY50.NSE".to_string(), "SENSEX.BSE".to_string()];
let indices_data = market_service.get_market_indices(&indices).await?;
```

### WebSocket Streaming

When WebSocket streaming is enabled (`PAYTM_USE_WEBSOCKET=true`), the service will:

1. Automatically establish a WebSocket connection on startup
2. Subscribe to symbols as they are requested via `get_symbol_prices`
3. Update the Redis cache with real-time data as it arrives
4. Maintain the connection with automatic reconnection on failure

You can also manually subscribe or unsubscribe from symbols:

```rust
// Subscribe to specific symbols for real-time updates
market_service.subscribe_to_symbols(&["RELIANCE.NSE", "INFY.NSE"]).await?;

// Unsubscribe when no longer needed
market_service.unsubscribe_from_symbols(&["RELIANCE.NSE"]).await?;
```

## Symbol Format

Paytm Money uses a specific format for symbols:

- Stocks: `SYMBOL.EXCHANGE` (e.g., `RELIANCE.NSE`, `INFY.BSE`)
- Indices: `INDEXNAME.EXCHANGE` (e.g., `NIFTY50.NSE`, `SENSEX.BSE`)
- ETFs: `ETFNAME.EXCHANGE` (e.g., `NIFTYBEES.NSE`)

Our integration handles the parsing and formatting of these symbols automatically.

## Error Handling

The integration provides comprehensive error handling:

- Connection failures with automatic retry
- Authentication errors with clear messages
- Data parsing errors with detailed information
- WebSocket disconnections with automatic reconnection

All errors are properly logged and propagated through the `ApiError` type.

## Performance Considerations

1. **Caching**: Market data is cached in Redis to reduce API calls
2. **Batching**: Requests are batched to minimize API calls
3. **WebSocket**: Real-time updates reduce the need for polling
4. **Background Updates**: Data is refreshed in the background
5. **Stale Data Management**: Unused data is automatically removed

## Limitations

1. Access tokens expire at midnight and need to be regenerated
2. Rate limits apply to the Paytm Money API
3. Some market data may be delayed based on your Paytm Money subscription

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Ensure your API key and tokens are correct
   - Tokens expire at midnight and need to be regenerated

2. **Connection Issues**
   - Check your network connection
   - Verify that the Paytm Money API is available

3. **Missing Data**
   - Ensure the symbols are in the correct format
   - Check if the market is open
   - Verify your subscription level with Paytm Money

### Logging

The integration uses the `tracing` crate for logging. Set the log level to `debug` for more detailed information:

```
RUST_LOG=market_pulse_api=debug,paytm=debug
```

## Future Improvements

1. Implement token refresh before expiration
2. Add support for order placement and portfolio management
3. Enhance error recovery mechanisms
4. Implement circuit breakers for API protection
5. Add metrics and monitoring for API usage