#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Server URL
SERVER_URL="http://localhost:3000"

# Test function
test_symbols_api() {
    local query=$1
    local endpoint="${SERVER_URL}/api/symbols/search?q=${query}"
    
    echo "Testing symbol search for: ${query}"
    
    # Make the API call and capture the response
    response=$(curl -s "$endpoint")
    
    # Check if the response contains results
    if echo "$response" | grep -q "results"; then
        echo -e "${GREEN}✓ API request successful${NC}"
        echo "Response:"
        echo "$response" | json_pp
    else
        echo -e "${RED}✗ API request failed${NC}"
        echo "Response:"
        echo "$response"
        return 1
    fi
    echo "----------------------------------------"
}

# Main execution
echo "Starting Symbols API Test..."
echo "----------------------------------------"

# Test cases
test_symbols_api "AAPL"  # Test with a known stock symbol
test_symbols_api "GOOG"  # Test with another known stock symbol
test_symbols_api "A"     # Test with a single character (should return empty)
test_symbols_api "ABC"   # Test with a generic pattern
test_symbols_api ""      # Test with empty query (should handle gracefully)

echo "Symbols API Test Complete"