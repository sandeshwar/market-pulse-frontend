#!/bin/bash

# Script to run the API in the foreground with full debug output

# Set the working directory to the project root
cd "$(dirname "$0")/.."

# Check if Redis is running
echo "Checking Redis status..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Redis is not running. Attempting to start Redis..."

    # Try to start Redis using Homebrew
    if command -v brew > /dev/null && brew list redis > /dev/null 2>&1; then
        echo "Starting Redis using Homebrew services..."
        brew services start redis
        sleep 2

        if ! redis-cli ping > /dev/null 2>&1; then
            echo "Failed to start Redis. Please start it manually."
            exit 1
        fi
    else
        echo "Redis is not installed via Homebrew or could not be started."
        echo "Please start Redis manually before running this script."
        exit 1
    fi
fi

echo "Redis is running."

# Ensure the data directory exists
DATA_DIR="../data"
if [ ! -d "$DATA_DIR" ]; then
    echo "Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# Set environment variables for debugging
export RUST_LOG=debug
export RUST_BACKTRACE=1

# Check if a custom port was specified
PORT=3001
if [ "$1" == "--port" ] && [ -n "$2" ]; then
    PORT=$2
    echo "Using custom port: $PORT"

    # Update the .env file with the new port
    if grep -q "API_PORT=" .env; then
        # Replace existing API_PORT line
        sed -i.bak "s/API_PORT=.*/API_PORT=$PORT/" .env
        echo "Updated API_PORT in .env file to $PORT."
    else
        # Add API_PORT line if it doesn't exist
        echo "API_PORT=$PORT" >> .env
        echo "Added API_PORT=$PORT to .env file."
    fi
fi

# Check if the port is already in use
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "Port $PORT is already in use. You can specify a different port with --port option:"
    echo "  $0 --port 3002"
    exit 1
fi

echo "Starting the API in foreground mode with debug logging on port $PORT..."
echo "Press Ctrl+C to stop the API."
echo "---------------------------------------------------"

# Set additional environment variables for more verbose logging
export RUST_LOG=debug,market_pulse_api=trace,tower_http=debug,axum=debug
export RUST_BACKTRACE=full

echo "Using environment variables:"
echo "RUST_LOG=$RUST_LOG"
echo "RUST_BACKTRACE=$RUST_BACKTRACE"
echo "API_PORT=$PORT (from .env file)"

# Run the API in the foreground with the main binary specified and verbose output
cargo run --bin market_pulse_api