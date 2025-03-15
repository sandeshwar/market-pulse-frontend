# Market Pulse Rust API

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
