#!/bin/bash

# Define the API endpoint URL
URL="https://luminera.ai/market-pulse/api/symbols/search?q=SBC"

# Number of concurrent requests
CONCURRENT_REQUESTS=1000

# Number of iterations for each concurrent request
ITERATIONS=10

# Initialize a counter for total requests
TOTAL_REQUESTS=0

# Log file for detailed output
LOG_FILE="stress_test_log.txt"

# Use xargs alternative to run curl commands concurrently
for ((i=0; i<ITERATIONS; i++)); do
    for ((j=0; j<CONCURRENT_REQUESTS; j++)); do
        ((TOTAL_REQUESTS++)) # Increment the counter
        curl -s -w "%{http_code} $(date +%s.%N)\n" "$URL" >> "$LOG_FILE" &
    done
    wait
done

# Log the total number of requests sent
echo "Total requests sent: $TOTAL_REQUESTS"
