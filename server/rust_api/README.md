# Market Pulse API

A high-performance API for the Market Pulse application, providing market data, symbol search, and more.

## Features

- Symbol search and lookup
- Market indices data
- Real-time market data from Paytm Money
- Redis caching for high performance
- Background data updater for keeping cache fresh
- Automatic stale data cleanup

## Setup

### Prerequisites

- Rust (latest stable version)
- Redis server
- Paytm Money API credentials

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your environment variables
3. Run `cargo build --release` to build the project

### Configuration

The following environment variables can be configured in the `.env` file:

```
# Redis configuration
REDIS_URL=redis://localhost:6379

# Paytm API configuration
PAYTM_API_KEY=your_paytm_api_key_here
PAYTM_ACCESS_TOKEN=your_paytm_access_token_here
PAYTM_PUBLIC_ACCESS_TOKEN=your_paytm_public_access_token_here

# Market data configuration
MARKET_DATA_CACHE_DURATION=60
MARKET_DATA_UPDATE_INTERVAL=60
MARKET_DATA_STALE_THRESHOLD=300

# Logging
RUST_LOG=market_pulse_api=debug,tower_http=debug
```

### Paytm Money API Integration

To use the Paytm Money API, you need to:

1. Register for a Paytm Money developer account at https://developer.paytmmoney.com/
2. Create an application to get your API key
3. Generate access tokens using the provided utility script:

```bash
# Run the token generation script
cargo run --bin generate_paytm_tokens

# Follow the prompts to:
# - Enter your API key
# - Open the login URL in your browser
# - Complete the Paytm Money login process
# - Copy the redirect URL back to the terminal
```

4. Add the generated credentials to your `.env` file

The API uses the following Paytm Money endpoints:
- Live Market Data API for fetching real-time stock and index data

## Running the API

```bash
cargo run --release
```

The API will start on port 3001 by default.

## API Endpoints

### Symbol Search

```
GET /api/symbols/search?query=RELIANCE&limit=10
```

### Market Indices

```
GET /api/indices
```

### Symbol Prices

```
GET /api/market-data/prices?symbols=RELIANCE,TCS,INFY
```

### Market Indices Data

```
GET /api/market-data/indices?symbols=NIFTY,SENSEX
```

## Architecture

The API follows a modular architecture:

- **Handlers**: API endpoint handlers
- **Services**: Business logic and data processing
- **Models**: Data structures and types
- **Utils**: Utility functions

### Market Data Flow

1. When a request for market data is received, the API first checks the Redis cache
2. If the data is available and not expired, it's returned immediately
3. If not, the API fetches the data from Paytm Money, caches it, and returns it
4. A background task periodically updates the cached data for frequently accessed symbols
5. Stale data (not accessed for a configurable period) is automatically removed

## Development

### Adding a New Data Provider

To add a new market data provider:

1. Create a new module in `src/services/market_data_provider/`
2. Implement the `MarketDataProvider` trait
3. Update the `MarketDataService` to use the new provider

### Testing

Run the tests with:

```bash
cargo test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.# Market Pulse Rust API

This is a high-performance Rust API for the Market Pulse application. It provides endpoints for accessing market data, symbols, and indices with extremely low latency.

## Features

- Symbol search with efficient caching
- Market indices data
- Historical price data (planned)
- Real-time updates (planned)

## Getting Started

### Prerequisites

- Rust (latest stable version)
- Redis server
- Cargo

### Installation

1. Clone the repository
2. Navigate to the `server/rust_api` directory
3. Run `cargo build --release`

### Environment Variables

Create a `.env` file in the `server/rust_api` directory with the following variables:

```
REDIS_URL=redis://localhost:6379
RUST_LOG=market_pulse_api=debug,tower_http=debug
```

### Running the API

```bash
cargo run --release
```

The API will be available at `http://localhost:3001`.

## API Endpoints

### Health Check

```
GET /api/health
```

Returns the health status of the API.

### Symbol Search

```
GET /api/symbols/search?q=AAPL&limit=10
```

Search for symbols by name or ticker.

### Market Indices

```
GET /api/indices
```

Get all market indices.

```
GET /api/indices?symbol=SPX
```

Get a specific market index.

## Architecture

The API is built using the Axum web framework and follows a clean architecture pattern:

- **Models**: Data structures representing domain entities
- **Services**: Business logic and data access
- **Handlers**: API endpoints that use services to process requests
- **Utils**: Utility functions for common tasks

## Performance

The API is designed for high performance with:

- Efficient in-memory caching
- Redis for distributed caching
- Asynchronous processing with Tokio
- Minimal allocations and copying
