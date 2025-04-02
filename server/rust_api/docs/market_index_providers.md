# Market Index Providers

This document describes the market index providers used in the Market Pulse API.

## Overview

The Market Pulse API uses dedicated providers for market indices rather than trying to use stock data providers like Tiingo. This is because market indices often require specialized data sources.

## Available Providers

### 1. Wall Street Journal (WSJ) Provider

The WSJ provider scrapes market index data from the Wall Street Journal website. It supports major indices like:

- Dow Jones Industrial Average (DJI)
- S&P 500 (SPX)
- NASDAQ Composite (IXIC)
- NASDAQ 100 (NDX)
- CBOE Volatility Index (VIX)

This is the default provider used by the application.

### 2. Google Finance Provider

The Google Finance provider fetches market index data from Google Finance. It supports similar indices to the WSJ provider.

## Configuration

The market index provider is configured in `main.rs`:

```rust
// Initialize the market index provider (WSJ is the default)
let market_index_provider = services::market_index_provider::factory::MarketIndexProviderFactory::create("wsj");

// Update the market index service with the provider
market_index_service.set_provider(market_index_provider).await;
```

To change the provider, simply change the provider name from "wsj" to "google".

## Architecture

The market index system uses a provider pattern:

1. `MarketIndexProvider` - A trait defining the interface for market index providers
2. `MarketIndexProviderFactory` - A factory for creating market index providers
3. `MarketIndexService` - A service that uses a provider to fetch and cache market index data

## Why Not Tiingo?

Tiingo does not directly provide market index data through their API. After reviewing their documentation, we confirmed that they only offer stock, ETF, and cryptocurrency data.

While it's possible to use ETFs that track indices as proxies (e.g., using SPY for SPX), this approach has several limitations:

1. ETFs don't perfectly track their underlying indices
2. Not all indices have corresponding ETFs available in Tiingo
3. International indices are particularly problematic

For these reasons, we use dedicated market index providers instead.