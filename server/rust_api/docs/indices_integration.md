# Indices Market Data API Integration

This document provides a guide to the Indices Market Data API integration in the Market Pulse application.

## Overview

The integration with TradingView's indices data allows our application to:

1. Fetch comprehensive data for global market indices
2. Provide a consistent API interface alongside other market data providers

## Setup and Configuration

### Prerequisites

1. Redis server (same as used for other services)
2. The indices_extractor microservice running and populating Redis

No additional configuration is needed for the indices service as it simply reads data from Redis.

## Architecture

The indices integration consists of two main components:

### 1. Indices Extractor Microservice

- Scrapes indices data from TradingView
- Stores data in Redis with a standardized format
- Runs on a configurable interval

### 2. Indices Market Data Service (`IndicesMarketDataService`)

- Reads indices data directly from Redis
- Implements the `MarketDataProvider` trait for consistent API
- Provides a unified interface for the application

## API Endpoints

### Get Specific Indices

```
GET /api/market-data/indices?symbols=SPX,DJI,IXIC
```

Returns data for the specified indices.

#### Query Parameters

- `symbols` (required): Comma-separated list of index symbols to retrieve

#### Response Format

```json
{
  "prices": {
    "SPX": {
      "symbol": "SPX",
      "price": 4927.21,
      "change": 35.88,
      "percent_change": 0.73,
      "volume": 0,
      "timestamp": 1644345600000,
      "additional_data": {
        "currency": "USD",
        "name": "S&P 500",
        "highPrice": 4931.37,
        "lowPrice": 4885.14,
        "technicalRating": "Buy"
      }
    },
    "DJI": {
      "symbol": "DJI",
      "price": 38521.36,
      "change": 125.69,
      "percent_change": 0.33,
      "volume": 0,
      "timestamp": 1644345600000,
      "additional_data": {
        "currency": "USD",
        "name": "Dow Jones Industrial Average",
        "highPrice": 38571.64,
        "lowPrice": 38272.47,
        "technicalRating": "Neutral"
      }
    }
  },
  "timestamp": 1644345600000
}
```

### Get All Available Indices

```
GET /api/market-data/indices/all
```

Returns data for all available indices.

#### Response Format

Same as above, but includes all indices available in the system.

## Data Model

The service provides the following data for each index:

- Symbol (e.g., "SPX", "DJI")
- Name (e.g., "S&P 500", "Dow Jones Industrial Average")
- Price
- Currency
- Change percentage
- Absolute change
- High
- Low
- Technical rating
- Timestamp

## Redis Data Structure

The service reads data from Redis using the key:

- `indices:tradingview:latest` - JSON string containing the entire collection of indices

This key is populated by the indices_extractor microservice.

## Error Handling

The indices API includes robust error handling:

1. Handles Redis connection errors gracefully
2. Returns appropriate error responses when indices are not found
3. Logs detailed information about any failures
4. Returns appropriate error types that can be handled by the calling code

## Troubleshooting

### Common Issues

1. **Missing Data**
   - Ensure the indices_extractor service is running
   - Check Redis connection settings
   - Verify that the indices symbols are correct

### Logging

The integration uses the `tracing` crate for logging. Set the log level to `debug` for more detailed information:

```
RUST_LOG=market_pulse_api=debug,indices=debug
```

## Future Improvements

1. Add support for filtering indices by region or category
2. Add support for historical indices data
3. Add metrics and monitoring for API usage