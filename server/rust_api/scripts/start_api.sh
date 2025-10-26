#!/bin/bash

# Script to start the Market Pulse API with proper initialization

# Set the working directory to the script's directory
cd "$(dirname "$0")"

# Make all scripts executable
echo "Making scripts executable..."
chmod +x *.sh

# Process command line arguments
BACKGROUND=true
PORT=3001
SKIP_BUILD=false
START_EXTRACTOR=true
EXTRACTOR_LOG="indices_extractor.log"
MAX_WAIT_TIME=60  # Maximum time to wait for API to start (in seconds)
CHECK_INTERVAL=5  # Time between checks (in seconds)

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --foreground)
            BACKGROUND=false
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-extractor)
            START_EXTRACTOR=false
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --foreground       Run the API in the foreground (default: background)"
            echo "  --port PORT        Specify the port to use (default: 3001)"
            echo "  --skip-build       Skip the build step (default: false)"
            echo "  --no-extractor     Do not start the indices extractor service"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help to see available options"
            exit 1
            ;;
    esac
done

# Check if Redis is running and start it if needed
echo "Checking Redis status..."
./check_redis.sh
if [ $? -ne 0 ]; then
    echo "Redis check failed. Please fix the Redis issues before continuing."
    exit 1
fi

# Ensure the data directory exists
DATA_DIR="../data"
if [ ! -d "$DATA_DIR" ]; then
    echo "Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# Update the .env file with the port
cd ..
if grep -q "API_PORT=" .env; then
    # Replace existing API_PORT line
    sed -i.bak "s/API_PORT=.*/API_PORT=$PORT/" .env
    echo "Updated API_PORT in .env file to $PORT."
else
    # Add API_PORT line if it doesn't exist
    echo "API_PORT=$PORT" >> .env
    echo "Added API_PORT=$PORT to .env file."
fi

# Check if the API is already running on the specified port
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "API is already running on port $PORT. Stopping it..."
    kill $(lsof -t -i :$PORT) || true
    sleep 2
fi

# Build the API and extractor if not skipped
if [ "$SKIP_BUILD" = false ]; then
    echo "Building the API..."

    # Check if OpenSSL is installed and set OPENSSL_DIR if needed
    if command -v openssl >/dev/null 2>&1; then
        OPENSSL_PATH=$(which openssl)
        OPENSSL_DIR=$(dirname $(dirname $OPENSSL_PATH))
        echo "Found OpenSSL at $OPENSSL_PATH, setting OPENSSL_DIR=$OPENSSL_DIR"
        export OPENSSL_DIR=$OPENSSL_DIR
    else
        echo "WARNING: OpenSSL not found in PATH. Build might fail."
    fi

    cargo build
    if [ $? -ne 0 ]; then
        echo "Failed to build the API. Please check the build errors."
        echo "If the error is related to OpenSSL, try installing OpenSSL development packages:"
        echo "  For Debian/Ubuntu: sudo apt-get install pkg-config libssl-dev"
        echo "  For Red Hat/CentOS/Fedora: sudo yum install openssl-devel"
        echo "  For Alpine Linux: apk add openssl-dev"
        exit 1
    fi

    if [ "$START_EXTRACTOR" = true ]; then
        echo "Building the indices extractor service..."
        (cd indices_extractor && cargo build)
        if [ $? -ne 0 ]; then
            echo "Failed to build the indices extractor service."
            exit 1
        fi
    fi
fi

# Set environment variables for debugging
export RUST_LOG=debug
export RUST_BACKTRACE=1

# Function to clean up background processes
cleanup() {
    if [ -n "$API_PID" ] && ps -p $API_PID > /dev/null 2>&1; then
        echo "Stopping API process (PID: $API_PID)"
        kill $API_PID 2>/dev/null || true
    fi
    if [ -n "$EXTRACTOR_PID" ] && ps -p $EXTRACTOR_PID > /dev/null 2>&1; then
        echo "Stopping indices extractor process (PID: $EXTRACTOR_PID)"
        kill $EXTRACTOR_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

# Function to check if the API is healthy
check_api_health() {
    local host=$1
    local response=$(curl -s "http://$host/api/health" 2>/dev/null)
    if [[ "$response" == *"status"*"ok"* ]]; then
        return 0
    else
        return 1
    fi
}

# Function to find an available port
find_available_port() {
    local start_port=$1
    local current_port=$start_port

    while lsof -i :$current_port > /dev/null 2>&1; do
        echo "Port $current_port is already in use, trying next port..."
        current_port=$((current_port + 1))
        if [ $current_port -gt $((start_port + 10)) ]; then
            echo "Could not find an available port in range $start_port-$((start_port + 10))"
            return 1
        fi
    done

    echo "Found available port: $current_port"
    echo $current_port
    return 0
}

if [ "$BACKGROUND" = true ]; then
    # Find an available port if the specified port is in use
    if lsof -i :$PORT > /dev/null 2>&1; then
        echo "Port $PORT is already in use, finding an available port..."
        AVAILABLE_PORT=$(find_available_port $PORT)
        if [ $? -eq 0 ]; then
            PORT=$AVAILABLE_PORT
            echo "Using port $PORT instead."

            # Update the .env file with the new port
            if grep -q "API_PORT=" .env; then
                sed -i.bak "s/API_PORT=.*/API_PORT=$PORT/" .env
                echo "Updated API_PORT in .env file to $PORT."
            else
                echo "API_PORT=$PORT" >> .env
                echo "Added API_PORT=$PORT to .env file."
            fi
        else
            echo "Failed to find an available port. Please specify a different port with --port."
            exit 1
        fi
    fi

    # Start the API in the background
    echo "Starting the API server in the background on port $PORT..."
    cargo run --bin market_pulse_api > api_startup.log 2>&1 &
    API_PID=$!

    if [ "$START_EXTRACTOR" = true ]; then
        echo "Starting the indices extractor service in the background..."
        (cd indices_extractor && cargo run --bin indices_extractor > "../$EXTRACTOR_LOG" 2>&1 &)
        EXTRACTOR_PID=$!
        echo "Indices extractor running with PID $EXTRACTOR_PID (logs: $EXTRACTOR_LOG)"
    fi

    # Wait for the API to start with progressive checks
    echo "Waiting for the API to start (PID: $API_PID)..."

    # Calculate the number of attempts based on MAX_WAIT_TIME and CHECK_INTERVAL
    MAX_ATTEMPTS=$((MAX_WAIT_TIME / CHECK_INTERVAL))

    # Try for up to MAX_WAIT_TIME seconds
    for i in $(seq 1 $MAX_ATTEMPTS); do
        echo "Checking if API is running (attempt $i/$MAX_ATTEMPTS)..."

        # Check if the process is still running
        if ! ps -p $API_PID > /dev/null; then
            echo "Process has terminated. Check the logs for errors:"
            tail -n 30 api_startup.log
            exit 1
        fi

        # Check if it's bound to the expected port
        if lsof -i :$PORT -P -n | grep LISTEN > /dev/null 2>&1; then
            echo "API is now listening on port $PORT."

            # Wait a bit more to ensure the API is fully initialized
            sleep 2

            # Check if the API is responding to health checks
            if check_api_health "localhost:$PORT"; then
                echo "API is responding to health checks."
                break
            else
                echo "API is bound to port $PORT but not responding to health checks yet."
            fi
        fi

        # Check if it's bound to any port
        BOUND_PORT=$(lsof -i -P -n | grep LISTEN | grep "$API_PID" | awk '{print $9}' | cut -d':' -f2 | head -1)
        if [ -n "$BOUND_PORT" ]; then
            echo "API is listening on port $BOUND_PORT instead of expected port $PORT."
            echo "Updating port information..."
            PORT=$BOUND_PORT

            # Update the .env file with the actual port
            if grep -q "API_PORT=" .env; then
                sed -i.bak "s/API_PORT=.*/API_PORT=$PORT/" .env
                echo "Updated API_PORT in .env file to $PORT."
            fi

            # Wait a bit more to ensure the API is fully initialized
            sleep 2

            # Check if the API is responding to health checks
            if check_api_health "localhost:$PORT"; then
                echo "API is responding to health checks."
                break
            else
                echo "API is bound to port $PORT but not responding to health checks yet."
            fi
        fi

        # If we're on the last attempt, show more diagnostic information
        if [ $i -eq $MAX_ATTEMPTS ]; then
            echo "API failed to bind to any port after $MAX_WAIT_TIME seconds. Checking logs..."
            echo "Last 30 lines of the log:"
            tail -n 30 api_startup.log

            echo "Process information:"
            ps -p $API_PID -o pid,ppid,command

            echo "Network connections for PID $API_PID:"
            lsof -i -P -n | grep "$API_PID" || echo "No network connections found"

            echo "Process is still running but not bound to any port."
            echo "You can try running in foreground mode to see all output:"
            echo "  ./scripts/start_api.sh --foreground"

            # Try to find any port the API might be listening on
            ALL_PORTS=$(lsof -i -P -n | grep "$API_PID" | grep LISTEN | awk '{print $9}' | cut -d':' -f2)
            if [ -n "$ALL_PORTS" ]; then
                echo "Found the API listening on unexpected ports: $ALL_PORTS"
                # Use the first port found
                PORT=$(echo "$ALL_PORTS" | head -1)
                echo "Using port $PORT for further operations."
            else
                echo "API is not listening on any port. Continuing with initialization anyway..."
            fi
        else
            echo "API not bound to any port yet. Waiting $CHECK_INTERVAL more seconds..."
            sleep $CHECK_INTERVAL
        fi
    done

    # Check if we found a port
    if lsof -i :$PORT -P -n | grep LISTEN | grep "$API_PID" > /dev/null 2>&1; then
        echo "API started successfully on port $PORT (PID: $API_PID)"

        # Check API health
        echo "Checking API health..."
        cd scripts
        ./check_api_health.sh --host "localhost:$PORT"

        echo "API startup completed. The API is now running on port $PORT."
        echo "To stop the API, run: kill $API_PID"
    else
        echo "WARNING: API process is running but not bound to port $PORT."
        echo "Check the logs for more information:"
        echo "  tail -f api_startup.log"
        echo "You can also try running in foreground mode:"
        echo "  ./scripts/start_api.sh --foreground"
    fi
else
    # Start the API in the foreground
    echo "Starting the API server in the foreground on port $PORT..."

    if [ "$START_EXTRACTOR" = true ]; then
        echo "Starting the indices extractor service in the background..."
        (cd indices_extractor && cargo run --bin indices_extractor > "../$EXTRACTOR_LOG" 2>&1 &)
        EXTRACTOR_PID=$!
        echo "Indices extractor running with PID $EXTRACTOR_PID (logs: $EXTRACTOR_LOG)"
    fi

    echo "Press Ctrl+C to stop the API."
    echo "---------------------------------------------------"
    cargo run --bin market_pulse_api
fi