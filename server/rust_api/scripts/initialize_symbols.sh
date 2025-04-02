#!/bin/bash

# Script to initialize symbols in the Market Pulse API
# This script will trigger the symbol initialization process in the API

# Default values
API_HOST="localhost:3001"
FORCE_DOWNLOAD=false
MAX_RETRIES=5
RETRY_DELAY=3

# Function to display usage information
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --host HOST       API host (default: localhost:3001)"
    echo "  -f, --force           Force download from Tiingo (bypasses Redis cache)"
    echo "  --help                Display this help message"
    echo
    echo "Example:"
    echo "  $0 --force"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            API_HOST="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_DOWNLOAD=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Please install jq first:"
    echo "  - On Ubuntu/Debian: sudo apt-get install jq"
    echo "  - On macOS: brew install jq"
    echo "  - On CentOS/RHEL: sudo yum install jq"
    exit 1
fi

# Function to check if the API is running
check_api_health() {
    echo "Checking if API is running at http://$API_HOST/api/health..."
    HEALTH_RESPONSE=$(curl -s "http://$API_HOST/api/health")

    if [[ "$HEALTH_RESPONSE" == *"status"*"ok"* ]]; then
        echo "API is running."
        return 0
    else
        echo "API is not responding correctly. Health check failed."
        return 1
    fi
}

# Check API health first
if ! check_api_health; then
    echo "Please make sure the API is running before initializing symbols."
    exit 1
fi

# First check the symbol cache status
echo "Checking symbol cache status..."
CACHE_URL="http://$API_HOST/api/symbols/cache/status"
CACHE_RESPONSE=$(curl -s "$CACHE_URL")

if [[ "$CACHE_RESPONSE" == *"symbol_count"* ]]; then
    CACHE_COUNT=$(echo "$CACHE_RESPONSE" | jq '.symbol_count')
    echo "Symbol cache contains $CACHE_COUNT symbols."

    # If we have symbols and not forcing a refresh, we're done
    if [[ "$CACHE_COUNT" -gt 0 && "$FORCE_DOWNLOAD" == "false" ]]; then
        echo "Symbol cache is already initialized. Use --force to refresh."
        exit 0
    fi
else
    echo "Could not get symbol cache status. Response:"
    echo "$CACHE_RESPONSE"
fi

# Check regular symbol count as well
echo "Checking current symbol count..."
COUNT_URL="http://$API_HOST/api/symbols/count"
COUNT_RESPONSE=$(curl -s "$COUNT_URL")

if [[ "$COUNT_RESPONSE" == *"count"* ]]; then
    CURRENT_COUNT=$(echo "$COUNT_RESPONSE" | jq '.count')
    echo "Current symbol count: $CURRENT_COUNT"

    # If we have symbols and not forcing a refresh, we're done
    if [[ "$CURRENT_COUNT" -gt 0 && "$FORCE_DOWNLOAD" == "false" ]]; then
        echo "Symbols are already initialized. Use --force to refresh."
        exit 0
    fi
else
    echo "Could not get symbol count. Response:"
    echo "$COUNT_RESPONSE"
fi

# If we're forcing a refresh or no symbols are loaded, trigger a refresh
if [[ "$FORCE_DOWNLOAD" == "true" || "$CACHE_COUNT" -eq 0 ]]; then
    echo
    echo "Triggering symbol cache refresh..."

    # Try the symbol cache refresh endpoint first
    REFRESH_URL="http://$API_HOST/api/symbols/cache/refresh"
    echo "Making refresh request to: $REFRESH_URL"
    REFRESH_RESPONSE=$(curl -s "$REFRESH_URL")

    if [[ "$REFRESH_RESPONSE" == *"symbol_count"* ]]; then
        REFRESH_COUNT=$(echo "$REFRESH_RESPONSE" | jq '.symbol_count')
        echo "Symbol cache refreshed with $REFRESH_COUNT symbols."

        if [[ "$REFRESH_COUNT" -gt 0 ]]; then
            echo "Success! Symbol cache has been refreshed."
            exit 0
        fi
    else
        echo "Symbol cache refresh failed. Response:"
        echo "$REFRESH_RESPONSE"
    fi

    # Fallback: try a simple search to trigger initialization
    echo
    echo "Trying alternative initialization method..."
    SEARCH_URL="http://$API_HOST/api/symbols/search?q=AAPL&limit=1"
    echo "Making search request to: $SEARCH_URL"
    SEARCH_RESPONSE=$(curl -s "$SEARCH_URL")

    # Check if we got any results
    if [[ "$SEARCH_RESPONSE" == *"results"* ]]; then
        SEARCH_COUNT=$(echo "$SEARCH_RESPONSE" | jq '.results | length')
        echo "Search returned $SEARCH_COUNT results"
    else
        echo "Search request failed. Response:"
        echo "$SEARCH_RESPONSE"
    fi

    # Wait a moment for initialization to potentially complete
    echo "Waiting for initialization to complete..."
    sleep 5

    # Check the count again with retries
    for ((i=1; i<=MAX_RETRIES; i++)); do
        echo
        echo "Checking symbol count after initialization (attempt $i/$MAX_RETRIES)..."
        COUNT_RESPONSE=$(curl -s "$COUNT_URL")

        if [[ "$COUNT_RESPONSE" == *"count"* ]]; then
            AFTER_COUNT=$(echo "$COUNT_RESPONSE" | jq '.count')
            echo "Symbol count after initialization: $AFTER_COUNT"

            if [[ "$AFTER_COUNT" -gt 0 ]]; then
                echo "Success! Symbols have been initialized."
                echo "You can now use fetch_symbols_by_range.sh to inspect the symbols."
                exit 0
            fi
        else
            echo "Could not get symbol count. Response:"
            echo "$COUNT_RESPONSE"
        fi

        if [[ $i -lt $MAX_RETRIES ]]; then
            echo "Waiting $RETRY_DELAY seconds before retrying..."
            sleep $RETRY_DELAY
        fi
    done

    # If we get here, initialization failed
    echo
    echo "Symbols could not be initialized automatically after $MAX_RETRIES attempts."
    echo
    echo "Troubleshooting suggestions:"
    echo "1. Check the API logs for any errors during symbol initialization"
    echo "2. Verify that Redis is running and accessible"
    echo "3. Check if the Tiingo API key is set correctly (if using Tiingo)"
    echo "4. Ensure the CSV file exists if using CSV initialization"
    echo "5. Restart the API server to trigger initialization again"
    echo
    echo "For manual initialization, you may need to:"
    echo "- Ensure the TIINGO_API_KEY environment variable is set"
    echo "- Check that the CSV file exists at ../data/tiingo_symbols.csv"
    echo "- Verify Redis connection settings"
    exit 1
fi