# Testing the Paytm Money API Integration

This document provides instructions for testing the Paytm Money API integration in the Market Pulse application.

## Prerequisites

Before running the tests, ensure you have:

1. A Paytm Money account with API access
2. API key from the Paytm Money Developer Portal
3. Access tokens generated using the token generation script
4. Environment variables set up in a `.env` file

## Setting Up Environment Variables

Create a `.env` file in the project root with the following variables:

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

## Test Scripts

We provide several test scripts to verify different aspects of the Paytm Money integration:

### 1. Token Generation Test

This script tests the token generation process:

```bash
cargo run --bin test_token_generation
```

This script will:
1. Prompt for your API key (or use the one from environment variables)
2. Generate a login URL for Paytm Money authentication
3. Extract the request token from the redirect URL
4. Exchange it for access tokens
5. Display the tokens to add to your environment

### 2. REST API Test

This script tests the REST API client:

```bash
cargo run --bin test_paytm_rest_api
```

This script will:
1. Test fetching market data for NSE symbols
2. Test fetching market data for BSE symbols
3. Test fetching market indices

### 3. WebSocket Test

This script tests the WebSocket client:

```bash
cargo run --bin test_paytm_websocket
```

This script will:
1. Establish a WebSocket connection
2. Subscribe to a set of symbols
3. Listen for real-time updates for 30 seconds
4. Unsubscribe from the symbols
5. Display a summary of received updates

### 4. Market Data Service Test

This script tests the entire market data service:

```bash
cargo run --bin test_market_data_service
```

This script will:
1. Test initial data fetch (should hit the API)
2. Test cached data fetch (should be faster)
3. Test fetching market indices
4. Test background update functionality
5. Test fetching a new symbol
6. Test cache expiration

## Adding the Scripts to Cargo.toml

Add the following to your `Cargo.toml` file to register the test scripts as binaries:

```toml
[[bin]]
name = "test_token_generation"
path = "scripts/test_token_generation.rs"

[[bin]]
name = "test_paytm_rest_api"
path = "scripts/test_paytm_rest_api.rs"

[[bin]]
name = "test_paytm_websocket"
path = "scripts/test_paytm_websocket.rs"

[[bin]]
name = "test_market_data_service"
path = "scripts/test_market_data_service.rs"
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Ensure your API key and tokens are correct
   - Tokens expire at midnight and need to be regenerated
   - Use the token generation script to get fresh tokens

2. **Connection Issues**
   - Check your network connection
   - Verify that the Paytm Money API is available
   - Check if there are any maintenance windows or outages

3. **Missing Data**
   - Ensure the symbols are in the correct format
   - Check if the market is open (tests will fail during market holidays)
   - Verify your subscription level with Paytm Money

### Logging

For more detailed logs, set the `RUST_LOG` environment variable:

```bash
RUST_LOG=market_pulse_api=debug,paytm=debug cargo run --bin test_paytm_rest_api
```

## Interpreting Test Results

### REST API Test

- Successful test will show price data for each symbol
- Check for any error messages
- Verify that the data looks reasonable (prices, percentages, etc.)

### WebSocket Test

- Successful test will show real-time updates as they arrive
- The number of updates will depend on market activity
- Check for any connection errors or subscription failures

### Market Data Service Test

- Compare the timing between initial fetch and cached fetch
- Verify that cache expiration works correctly
- Check that background updates refresh the data

## Next Steps

After successful testing:

1. Integrate the market data service into your application
2. Set up monitoring for API usage and performance
3. Implement error handling and retry mechanisms
4. Consider adding more comprehensive tests for edge cases