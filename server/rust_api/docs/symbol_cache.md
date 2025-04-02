# Symbol Cache Service

The Symbol Cache Service provides efficient caching and retrieval of Tiingo symbols using Redis. This document explains how the service works and how to use it.

## Overview

The Tiingo symbols database contains over 100,000 entries with metadata about financial instruments. The Symbol Cache Service loads this data into Redis for fast access and provides APIs for searching and filtering symbols.

## Benefits

- **Performance**: Near-instant symbol validation and search operations
- **Efficiency**: Reduced disk I/O by eliminating repeated file parsing
- **Flexibility**: Easy filtering by exchange, asset type, and other criteria
- **Reliability**: Automatic cache refresh and TTL management

## Redis Data Structure

The service uses the following Redis data structures:

1. **Hashes**: Store symbol metadata
   ```
   symbols:data:{TICKER} -> { exchange, assetType, priceCurrency, startDate, endDate }
   ```

2. **Sorted Sets**: Enable efficient prefix searches
   ```
   symbols:all -> [AAPL, MSFT, GOOGL, ...]
   ```

3. **Sets**: Allow filtering by attributes
   ```
   symbols:exchange:NYSE -> [AAPL, IBM, GE, ...]
   symbols:assetType:Stock -> [AAPL, MSFT, GOOGL, ...]
   symbols:currency:USD -> [AAPL, MSFT, GOOGL, ...]
   ```

4. **String**: Track cache metadata
   ```
   symbols:last_updated -> timestamp
   ```

## API Endpoints

The service exposes the following API endpoints:

### Get Cache Status

```
GET /api/symbols/cache/status
```

Returns information about the symbol cache, including the number of symbols and when it was last updated.

### Search Symbols by Prefix

```
GET /api/symbols/cache/search?query=AA&limit=10
```

Searches for symbols that start with the given prefix. Returns symbol records with full metadata.

### Get Symbols by Exchange

```
GET /api/symbols/cache/exchange?exchange=NYSE&limit=20
```

Returns symbols from the specified exchange.

### Get Symbols by Asset Type

```
GET /api/symbols/cache/asset-type?asset_type=Stock&limit=20
```

Returns symbols of the specified asset type.

### Refresh Cache

```
GET /api/symbols/cache/refresh
```

Forces a refresh of the symbol cache by reloading from the CSV file.

## Configuration

The Symbol Cache Service can be configured with the following parameters:

1. **CSV File Path**: Path to the Tiingo symbols CSV file
2. **Cache TTL**: Time-to-live for the cache in days (default: 7)

## Implementation Details

### Initialization

The service initializes the cache during application startup:

1. Checks if the cache already exists in Redis
2. If not, loads symbols from the CSV file into Redis
3. Sets the last updated timestamp and TTL

### Search Operations

Symbol searches use Redis ZSCAN operations for efficient prefix matching:

1. Scans the sorted set with a pattern like "AA*"
2. Retrieves full metadata for matching symbols
3. Returns results up to the specified limit

### Filtering Operations

Filtering uses Redis sets for efficient lookups:

1. Gets members of the appropriate set (e.g., `symbols:exchange:NYSE`)
2. Limits results to the specified count
3. Returns the matching symbols

### Cache Refresh

The cache can be refreshed manually or automatically:

1. Deletes all existing symbol keys from Redis
2. Reloads symbols from the CSV file
3. Updates the last updated timestamp and TTL

## Performance Considerations

- The initial cache loading may take a few seconds due to the large number of symbols
- Subsequent operations are very fast, typically completing in milliseconds
- Memory usage is approximately 50-100MB for the full symbol set
- Redis persistence ensures the cache survives server restarts

## Future Improvements

- Add support for fuzzy search
- Implement more advanced filtering (e.g., by date range, currency)
- Add support for incremental updates
- Implement background refresh job