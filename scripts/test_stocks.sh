#!/bin/bash

# Base URL and API key
base_url="https://api.marketdata.app/v1/stocks/quotes/"
api_key="${MARKET_DATA_API_KEY:-VG1hV1pNclRSeUYtZ2N1S2kyeXhvanBKbloyUTVtVGl6a2VjemNpazFyYz0}"

# Common tech stocks to test
tech_stocks=(
    "AAPL"  # Apple
    "MSFT"  # Microsoft
    "GOOGL" # Alphabet Class A
    "GOOG"  # Alphabet Class C
    "META"  # Meta Platforms
    "AMZN"  # Amazon
    "NVDA"  # NVIDIA
    "TSLA"  # Tesla
    "AMD"   # AMD
    "INTC"  # Intel
)

test_stock() {
    local symbol=$1
    local url="${base_url}${symbol}/?token=${api_key}"
    
    echo -n "Testing ${symbol}... "
    
    response=$(curl -s -L "${url}" \
        -H "Accept: application/json" \
        -H "User-Agent: Mozilla/5.0" \
        -H "Origin: https://marketdata.app" \
        -H "Referer: https://marketdata.app/" \
        --compressed)
    
    if echo "$response" | grep -q '"s":"ok"'; then
        price=$(echo "$response" | grep -o '"c":[0-9.]*' | cut -d':' -f2)
        echo "✅ Available (Current: $price)"
        return 0
    else
        echo "❌ Failed"
        echo "   Response: $response"
        return 1
    fi
}

# Try to fetch available symbols first
echo "Attempting to fetch available symbols..."
symbols_response=$(curl -s -L "https://api.marketdata.app/v1/stocks/available/?token=${api_key}" \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0" \
    -H "Origin: https://marketdata.app" \
    -H "Referer: https://marketdata.app/" \
    --compressed)

if echo "$symbols_response" | grep -q '"s":"ok"'; then
    echo "✅ API supports symbol listing!"
    # Extract first 10 symbols as example
    echo "First 10 supported symbols:"
    echo "$symbols_response" | grep -o '"symbol":"[^"]*"' | cut -d'"' -f4 | head -n 10
    echo -e "\n-----------------------------------\n"
fi

# Test known tech stocks
echo "Testing Major Tech Stocks..."
echo "-------------------------"
for symbol in "${tech_stocks[@]}"; do
    test_stock "$symbol"
done 