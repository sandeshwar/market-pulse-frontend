# Market Pulse Rust API Architecture

This document outlines the architecture of the Market Pulse Rust API, explaining the key components and how they interact.

## Overview

The Market Pulse Rust API is designed to provide high-performance, low-latency access to financial market data. It follows a modular architecture with clear separation of concerns:

```
market_pulse_api/
├── src/
│   ├── models/         # Data structures
│   ├── services/       # Business logic
│   ├── handlers/       # API endpoints
│   ├── utils/          # Utility functions
│   └── main.rs         # Application entry point
```

## Key Components

### Models

The models directory contains the core data structures used throughout the application:

- **symbol.rs**: Defines structures for representing financial symbols (stocks, ETFs, etc.)
- **market_data.rs**: Defines structures for time series and OHLCV data
- **error.rs**: Defines API error types and response structures

### Services

The services directory contains the business logic and data access layer:

- **symbol.rs**: Manages symbol data, including loading from CSV and searching
- **redis.rs**: Provides a Redis client for caching

### Handlers

The handlers directory contains the API endpoint implementations:

- **health.rs**: Health check endpoint
- **symbol.rs**: Symbol search endpoint

### Utils

The utils directory contains utility functions:

- **csv.rs**: Functions for reading CSV files

## Data Flow

1. Client makes a request to an API endpoint
2. The handler processes the request and calls the appropriate service
3. The service retrieves data from cache (Redis) or loads it from the source
4. The service processes the data and returns it to the handler
5. The handler formats the response and returns it to the client

## Caching Strategy

The API uses a two-level caching strategy:

1. **In-memory cache**: Data is stored in memory for fastest access
2. **Redis cache**: Data is also stored in Redis for persistence and sharing between instances

## Error Handling

The API uses a consistent error handling approach:

1. Services return `Result<T, ApiError>` for all operations
2. Handlers convert `ApiError` to `ErrorResponse` for client-friendly error messages
3. All errors are logged with appropriate context

## Performance Considerations

- **Async I/O**: The API uses Tokio for asynchronous I/O operations
- **Connection pooling**: Redis connections are pooled for efficiency
- **Minimal copying**: Data structures are designed to minimize copying
- **Efficient serialization**: Serde is used for efficient JSON serialization/deserialization

## Future Enhancements

- **WebSocket support**: For real-time data updates
- **Authentication**: For secure access to premium features
- **Rate limiting**: To prevent abuse
- **Metrics**: For monitoring performance and usage
- **Database integration**: For persistent storage beyond Redis