# Market Pulse API

A high-performance API for the Market Pulse application, providing market data, symbol search, and more.

## Features

- Symbol search and lookup
- Market indices data
- Real-time market data from Tiingo
- Redis caching for high performance
- Background data updater for keeping cache fresh
- Automatic stale data cleanup

## Setup

### Prerequisites

- Rust (latest stable version)
- Redis server
- Tiingo API key

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your environment variables
3. Run `cargo build --release` to build the project

### Configuration

The following environment variables can be configured in the `.env` file:

```
# Redis configuration
REDIS_URL=redis://localhost:6379

# Tiingo API configuration
TIINGO_API_KEY=your_tiingo_api_key_here

# Market data configuration
MARKET_DATA_CACHE_DURATION=60
MARKET_DATA_UPDATE_INTERVAL=60
MARKET_DATA_STALE_THRESHOLD=300

# Logging
RUST_LOG=market_pulse_api=debug,tower_http=debug
```

### Tiingo API Integration

To use the Tiingo API, you need to:

1. Register for a Tiingo account at https://www.tiingo.com/
2. Get your API key from your account dashboard
3. Add the API key to your `.env` file

The API uses the Tiingo endpoints for fetching real-time stock data, and the Wall Street Journal (WSJ) for market indices data.

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

### Stock Prices

```
GET /api/market-data/stocks?symbols=AAPL,MSFT,GOOGL
```

This endpoint is specifically for stock symbols and will reject any index symbols.

### Market Indices Data

```
GET /api/market-data/indices?symbols=SPX,DJI,IXIC
```

This endpoint is specifically for index symbols and will reject any stock symbols.


## Architecture

The API follows a modular architecture:

- **Handlers**: API endpoint handlers
- **Services**: Business logic and data processing
- **Models**: Data structures and types
- **Utils**: Utility functions

### Market Data Flow

1. When a request for market data is received, the API first checks the Redis cache
2. If the data is available and not expired, it's returned immediately
3. If not, the API fetches the data from the appropriate provider:
   - Stock data: Fetched from Tiingo API
   - Market indices: Fetched from Wall Street Journal (WSJ)
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
- jq (for the utility scripts)

### Installation

1. Clone the repository
2. Navigate to the `server/rust_api` directory
3. Copy `.env.example` to `.env` and configure your environment variables
4. Run `cargo build --release`

### Environment Variables

Create a `.env` file in the `server/rust_api` directory with the following variables:

```
# Redis configuration
REDIS_URL=redis://localhost:6379

# API configuration
API_PORT=3001
API_HOST=0.0.0.0

# Tiingo API configuration
TIINGO_API_KEY=your_tiingo_api_key_here

# Market data configuration
MARKET_DATA_CACHE_DURATION=60
MARKET_DATA_UPDATE_INTERVAL=60
MARKET_DATA_STALE_THRESHOLD=300

# Logging
RUST_LOG=market_pulse_api=debug,tower_http=debug

# Symbol data configuration
TIINGO_SYMBOLS_UPDATE_INTERVAL_HOURS=168 # 7 days (24 * 7)

# Data paths
DATA_DIR=../data
TIINGO_SYMBOLS_FILE=../data/tiingo_symbols.csv
```

### Running the API

We've provided a simplified set of scripts to help you run and manage the API:

1. First, make all scripts executable:
   ```bash
   ./scripts/make_scripts_executable.sh
   ```

2. Start the API with a single command:
   ```bash
   ./scripts/start_api.sh
   ```

This will:
- Check if Redis is running and start it if needed
- Create the necessary data directories
- Build and start the API
- Initialize the symbol cache
- Check the API health

#### Script Options

The start_api.sh script supports several options:

```bash
# Run in foreground mode
./scripts/start_api.sh --foreground

# Use a different port
./scripts/start_api.sh --port 3002

# Skip the build step
./scripts/start_api.sh --skip-build

# Show help
./scripts/start_api.sh --help
```

#### Running in Foreground

If you want to see all the output and errors in real-time:

```bash
./scripts/run_api_foreground.sh
```

#### Manual Startup

Alternatively, you can run the API manually:
```bash
cargo run --bin market_pulse_api --release
```

Or simply:
```bash
cargo run --release
```

The API will be available at `http://localhost:3001` by default.

#### Multiple Binaries

This project contains multiple binaries. The main API binary is `market_pulse_api`, but there are also test binaries available:
- `test_token_generation`
- `test_market_data_service`
- `test_tiingo_api`
- `test_tiingo_service`
- `test_tiingo_symbols`

To run a specific test binary, use:
```bash
cargo run --bin test_tiingo_api
```

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

### Symbol Range

```
GET /api/symbols/range?start=0&end=100
```

Get symbols by range (for troubleshooting).

### Symbol Count

```
GET /api/symbols/count
```

Get the total count of available symbols.

### Market Indices

```
GET /api/indices
```

Get all market indices.

```
GET /api/indices?symbol=SPX
```

Get a specific market index.

### Market Data

```
GET /api/market-data/stocks?symbols=AAPL,MSFT,GOOGL
```

Get market data for specific stock symbols.

```
GET /api/market-data/indices?symbols=SPX,DJI,IXIC
```

Get market data for specific index symbols.

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

## Troubleshooting

If you're experiencing issues with the API, try the following:

1. **Run in Foreground Mode**: This is the easiest way to see all errors in real-time
   ```bash
   ./scripts/start_api.sh --foreground
   ```

   Or use the dedicated foreground script:
   ```bash
   ./scripts/run_api_foreground.sh
   ```

2. **Check Redis**: Make sure Redis is running and accessible
   ```bash
   ./scripts/check_redis.sh
   ```

3. **Check API Health**: Verify that the API is running and responding
   ```bash
   ./scripts/check_api_health.sh
   ```

4. **Initialize Symbols**: If no symbols are available, try initializing them
   ```bash
   ./scripts/initialize_symbols.sh
   ```

5. **Find the API Port**: If the API is running but you're not sure on which port
   ```bash
   ./scripts/find_api_port.sh
   ```

6. **Try a Different Port**: If port 3001 is in use, specify a different port
   ```bash
   ./scripts/start_api.sh --port 3002
   ```

7. **Check Logs**: If the API fails to start, check the startup log
   ```bash
   tail -n 50 api_startup.log
   ```

### Common Issues and Solutions

1. **API not binding to port 3001**:
   - Check if another process is using the port: `lsof -i :3001`
   - Use a different port: `./scripts/start_api.sh --port 3002`
   - Run in foreground mode to see binding errors: `./scripts/start_api.sh --foreground`
   - Find which port the API is actually using: `./scripts/find_api_port.sh`

   Note: The API will now automatically try alternative ports if the requested port is in use. It will log which port it's using, but you may need to use the `find_api_port.sh` script to locate it if you're running in background mode.

2. **Redis connection issues**:
   - Ensure Redis is installed and running: `redis-cli ping`
   - Check the REDIS_URL in your .env file
   - Try starting Redis manually: `brew services start redis`

3. **Symbol data not loading**:
   - Check if the data directory exists: `ls -la ../data`
   - Run the initialize_symbols.sh script
   - Check for errors in the API logs

4. **API crashes on startup**:
   - Run in foreground mode to see all errors: `./scripts/start_api.sh --foreground`
   - Check for missing environment variables
   - Ensure all dependencies are installed

5. **Multiple binaries error**:
   If you see an error like:
   ```
   error: `cargo run` could not determine which binary to run. Use the `--bin` option to specify a binary, or the `default-run` manifest key.
   ```
   Use the `--bin` option to specify the main binary:
   ```bash
   cargo run --bin market_pulse_api
   ```
   Or use our scripts which already specify the correct binary.
