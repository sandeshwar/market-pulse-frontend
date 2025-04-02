#!/bin/bash

# Script to check the health of the Market Pulse API and get basic information

# Default values
API_HOST="localhost:3001"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            API_HOST="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [-h|--host HOST]"
            exit 1
            ;;
    esac
done

echo "Checking API health at $API_HOST..."

# Check API health
HEALTH_URL="http://$API_HOST/api/health"
HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")

echo "Health check response:"
echo "$HEALTH_RESPONSE" | jq .

# Get total symbol count
echo
echo "Checking total symbol count..."
COUNT_URL="http://$API_HOST/api/symbols/count"
COUNT_RESPONSE=$(curl -s "$COUNT_URL")

if [[ "$COUNT_RESPONSE" == *"error"* ]]; then
    echo "Error from API when getting symbol count:"
    echo "$COUNT_RESPONSE" | jq .
else
    echo "Symbol count response:"
    echo "$COUNT_RESPONSE" | jq .
    TOTAL_COUNT=$(echo "$COUNT_RESPONSE" | jq '.count')
    echo "Total symbols available: $TOTAL_COUNT"
fi

# Try to get symbol count by fetching a small range
echo
echo "Checking symbol availability by range..."
RANGE_URL="http://$API_HOST/api/symbols/range?start=0&end=1"
RANGE_RESPONSE=$(curl -s "$RANGE_URL")

if [[ "$RANGE_RESPONSE" == *"error"* ]]; then
    echo "Error from API when fetching symbols by range:"
    echo "$RANGE_RESPONSE" | jq .
else
    echo "Symbol range response structure:"
    echo "$RANGE_RESPONSE" | jq 'keys'

    # Check if we have results
    RESULTS_COUNT=$(echo "$RANGE_RESPONSE" | jq '.results | length')
    echo "Symbols found in range [0,1]: $RESULTS_COUNT"

    if [[ "$RESULTS_COUNT" -gt 0 ]]; then
        echo "First symbol details:"
        echo "$RANGE_RESPONSE" | jq '.results[0]'
    fi
fi

# Try to search for a common symbol
echo
echo "Testing symbol search..."
SEARCH_URL="http://$API_HOST/api/symbols/search?q=AAPL&limit=1"
SEARCH_RESPONSE=$(curl -s "$SEARCH_URL")

if [[ "$SEARCH_RESPONSE" == *"error"* ]]; then
    echo "Error from API when searching symbols:"
    echo "$SEARCH_RESPONSE" | jq .
else
    echo "Symbol search response structure:"
    echo "$SEARCH_RESPONSE" | jq 'keys'
    
    # Check if we have results
    SEARCH_COUNT=$(echo "$SEARCH_RESPONSE" | jq '.results | length')
    echo "Symbols found for 'AAPL': $SEARCH_COUNT"
    
    if [[ "$SEARCH_COUNT" -gt 0 ]]; then
        echo "First search result details:"
        echo "$SEARCH_RESPONSE" | jq '.results[0]'
    fi
fi