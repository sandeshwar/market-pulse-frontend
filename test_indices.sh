#!/bin/bash

# Major US Indices
us_indices=(
    "SPX"   # S&P 500
    "DJI"   # Dow Jones Industrial Average
    "IXIC"  # NASDAQ Composite
    "NDX"   # NASDAQ 100
    # "RUT"   # Russell 2000 - Not supported as of 2025-02-11
    "VIX"   # CBOE Volatility Index
)

# Major European Indices - Not supported as of 2025-02-11
# europe_indices=(
#     "FTSE"  # FTSE 100 (UK)
#     "DAX"   # DAX 40 (Germany) 
#     "CAC"   # CAC 40 (France)
#     "STOXX" # EURO STOXX 50
#     "IBEX"  # IBEX 35 (Spain)
#     "FTSEMIB" # FTSE MIB (Italy)
# )

# Major Asian Indices - Not supported as of 2025-02-11
# asia_indices=(
#     "N225"  # Nikkei 225 (Japan)
#     "HSI"   # Hang Seng (Hong Kong)
#     "SSEC"  # Shanghai Composite
#     "KOSPI" # Korea Composite
#     "SENSEX" # BSE SENSEX (India)
#     "NIFTY" # NIFTY 50 (India)
# )

# Base URL for the quotes endpoint
base_url="https://api.marketdata.app/v1/indices/quotes/"
api_key="${MARKET_DATA_API_KEY:-VG1hV1pNclRSeUYtZ2N1S2kyeXhvanBKbloyUTVtVGl6a2VjemNpazFyYz0}"

test_index() {
    local index=$1
    local url="${base_url}${index}/?token=${api_key}"
    
    echo -n "Testing ${index}... "
    
    response=$(curl -s -L "${url}" \
        -H "Accept: application/json" \
        -H "User-Agent: Mozilla/5.0" \
        -H "Origin: https://marketdata.app" \
        -H "Referer: https://marketdata.app/" \
        --compressed)
    
    if echo "$response" | grep -q '"s":"ok"'; then
        echo "✅ Available"
        return 0
    else
        echo "❌ Failed"
        echo "   Response: $response"
        return 1
    fi
}

main() {
    echo "Testing US Indices..."
    echo "--------------------"
    for index in "${us_indices[@]}"; do
        test_index "$index"
    done

    echo -e "\nTesting European Indices..."
    echo "-------------------------"
    for index in "${europe_indices[@]}"; do
        test_index "$index"
    done

    echo -e "\nTesting Asian Indices..."
    echo "----------------------"
    for index in "${asia_indices[@]}"; do
        test_index "$index"
    done
}

main 