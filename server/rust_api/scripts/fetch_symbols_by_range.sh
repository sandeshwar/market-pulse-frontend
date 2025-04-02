#!/bin/bash

# Script to fetch symbols by range from the Market Pulse API
# This is a troubleshooting tool to inspect symbols in the database

# Default values
API_HOST="localhost:3001"
START=0
END=100
OUTPUT_FORMAT="table"  # Options: json, table, csv
DEBUG=false
OUTPUT_FILE=""
FIELDS="symbol,name,exchange,asset_type"

# Function to display usage information
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --host HOST       API host (default: localhost:3001)"
    echo "  -s, --start INDEX     Start index (default: 0)"
    echo "  -e, --end INDEX       End index (default: 100)"
    echo "  -f, --format FORMAT   Output format: json, table, csv (default: table)"
    echo "  -o, --output FILE     Output file (default: stdout)"
    echo "  --fields FIELDS       Comma-separated list of fields to include (default: symbol,name,exchange,asset_type)"
    echo "  -d, --debug           Enable debug output"
    echo "  --help                Display this help message"
    echo
    echo "Example:"
    echo "  $0 --start 100 --end 200 --format csv"
    echo "  $0 --output symbols.json --format json"
    echo "  $0 --fields symbol,name --format table"
    exit 1
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Please install jq first:"
    echo "  - On Ubuntu/Debian: sudo apt-get install jq"
    echo "  - On macOS: brew install jq"
    echo "  - On CentOS/RHEL: sudo yum install jq"
    exit 1
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            API_HOST="$2"
            shift 2
            ;;
        -s|--start)
            START="$2"
            shift 2
            ;;
        -e|--end)
            END="$2"
            shift 2
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --fields)
            FIELDS="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG=true
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

# Validate inputs
if ! [[ "$START" =~ ^[0-9]+$ ]]; then
    echo "Error: Start index must be a number"
    exit 1
fi

if ! [[ "$END" =~ ^[0-9]+$ ]]; then
    echo "Error: End index must be a number"
    exit 1
fi

if [[ "$START" -ge "$END" ]]; then
    echo "Error: Start index must be less than end index"
    exit 1
fi

if [[ "$OUTPUT_FORMAT" != "json" && "$OUTPUT_FORMAT" != "table" && "$OUTPUT_FORMAT" != "csv" ]]; then
    echo "Error: Format must be one of: json, table, csv"
    exit 1
fi

# Calculate range size
RANGE_SIZE=$((END - START))
echo "Fetching symbols from index $START to $END (total: $RANGE_SIZE symbols)..."

# First check if the API is running and get the total count
if $DEBUG; then
    echo "Checking API health and symbol count..."
    COUNT_URL="http://$API_HOST/api/symbols/count"
    COUNT_RESPONSE=$(curl -s "$COUNT_URL")

    if [[ "$COUNT_RESPONSE" == *"error"* ]]; then
        echo "Error from API when getting symbol count:"
        echo "$COUNT_RESPONSE" | jq .
    else
        TOTAL_COUNT=$(echo "$COUNT_RESPONSE" | jq '.count')
        echo "Total symbols available: $TOTAL_COUNT"

        if [[ "$END" -gt "$TOTAL_COUNT" ]]; then
            echo "Warning: End index ($END) is greater than total count ($TOTAL_COUNT)"
            echo "Adjusting end index to $TOTAL_COUNT"
            END=$TOTAL_COUNT
            RANGE_SIZE=$((END - START))
        fi
    fi
fi

# Make the API request
API_URL="http://$API_HOST/api/symbols/range?start=$START&end=$END"
if $DEBUG; then
    echo "Requesting: $API_URL"
fi
RESPONSE=$(curl -s "$API_URL")

# Debug: Show raw response
if $DEBUG; then
    echo "Raw API response (first 300 characters):"
    echo "${RESPONSE:0:300}..."
    echo
fi

# Check if the request was successful
if [[ "$RESPONSE" == *"error"* ]]; then
    echo "Error from API:"
    echo "$RESPONSE" | jq .
    exit 1
fi

# Debug: Show parsed response structure
if $DEBUG; then
    echo "Response structure:"
    echo "$RESPONSE" | jq 'keys'
    echo "Results count:"
    echo "$RESPONSE" | jq '.results | length'
    echo
fi

# Convert fields string to array
IFS=',' read -r -a FIELD_ARRAY <<< "$FIELDS"

# Process the response based on the requested format
OUTPUT=""
case "$OUTPUT_FORMAT" in
    json)
        # Extract only the requested fields
        if [[ "$FIELDS" != "symbol,name,exchange,asset_type" ]]; then
            # Create a jq filter to select only the specified fields
            JQ_FILTER=".results[] | {"
            for field in "${FIELD_ARRAY[@]}"; do
                JQ_FILTER+="$field: .$field,"
            done
            # Remove trailing comma and close the object
            JQ_FILTER=${JQ_FILTER%,}
            JQ_FILTER+="}"

            # Apply the filter
            OUTPUT=$(echo "$RESPONSE" | jq "[${JQ_FILTER}]")
        else
            # Use all fields
            OUTPUT=$(echo "$RESPONSE" | jq '.results')
        fi

        # Pretty print
        OUTPUT=$(echo "$OUTPUT" | jq '.')
        ;;
    table)
        # Create header row
        HEADER=""
        SEPARATOR=""
        for field in "${FIELD_ARRAY[@]}"; do
            # Convert field name to title case
            TITLE=$(echo "$field" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
            HEADER+="$TITLE | "
            SEPARATOR+="--- | "
        done
        # Remove trailing separator
        HEADER=${HEADER% | }
        SEPARATOR=${SEPARATOR% | }

        # Create table
        OUTPUT="$HEADER\n$SEPARATOR"

        # Create jq filter to extract fields in order
        JQ_FILTER='.results[] | ['
        for field in "${FIELD_ARRAY[@]}"; do
            JQ_FILTER+=".$field,"
        done
        # Remove trailing comma and close the array
        JQ_FILTER=${JQ_FILTER%,}
        JQ_FILTER+='] | join(" | ")'

        # Apply the filter
        ROWS=$(echo "$RESPONSE" | jq -r "$JQ_FILTER")

        # Add rows to output
        if [[ -n "$ROWS" ]]; then
            OUTPUT+="\n$ROWS"
        fi
        ;;
    csv)
        # Create header row
        HEADER=""
        for field in "${FIELD_ARRAY[@]}"; do
            HEADER+="$field,"
        done
        # Remove trailing comma
        HEADER=${HEADER%,}

        # Create CSV
        OUTPUT="$HEADER"

        # Create jq filter to extract fields in order
        JQ_FILTER='.results[] | ['
        for field in "${FIELD_ARRAY[@]}"; do
            JQ_FILTER+=".$field,"
        done
        # Remove trailing comma and close the array
        JQ_FILTER=${JQ_FILTER%,}
        JQ_FILTER+='] | @csv'

        # Apply the filter
        ROWS=$(echo "$RESPONSE" | jq -r "$JQ_FILTER")

        # Add rows to output
        if [[ -n "$ROWS" ]]; then
            OUTPUT+="\n$ROWS"
        fi
        ;;
esac

# Output the result
ACTUAL_COUNT=$(echo "$RESPONSE" | jq '.results | length')

if [[ -n "$OUTPUT_FILE" ]]; then
    # Write to file
    echo -e "$OUTPUT" > "$OUTPUT_FILE"
    echo "Successfully fetched $ACTUAL_COUNT symbols. Results written to $OUTPUT_FILE"
else
    # Print to stdout
    echo -e "$OUTPUT"
    echo
    echo "Successfully fetched $ACTUAL_COUNT symbols."
fi