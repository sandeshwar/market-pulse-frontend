#!/bin/bash

# Script to find which port the API is running on

# Set the working directory to the script's directory
cd "$(dirname "$0")"

# Check if the API process is running
API_PROCESS=$(ps aux | grep "market_pulse_api" | grep -v grep)

if [ -z "$API_PROCESS" ]; then
    echo "No Market Pulse API process found running."
    exit 1
fi

echo "Market Pulse API process found:"
echo "$API_PROCESS"

# Get the process ID
PID=$(echo "$API_PROCESS" | awk '{print $2}')
echo "Process ID: $PID"

# Check which ports this process is listening on
echo "Checking ports for PID $PID..."
PORTS=$(lsof -i -P -n | grep LISTEN | grep "$PID" | awk '{print $9}' | cut -d':' -f2)

if [ -z "$PORTS" ]; then
    echo "Process $PID is not listening on any ports."
    
    # Check if it's still starting up
    RUNTIME=$(ps -o etime= -p "$PID")
    echo "Process has been running for: $RUNTIME"
    
    echo "Process might still be starting up or has failed to bind to a port."
    echo "Check the logs for more information."
    
    # Check for any open files
    echo "Open files for PID $PID:"
    lsof -p "$PID" | head -20
    
    # Check for any network connections
    echo "Network connections for PID $PID:"
    lsof -i -P -n | grep "$PID" || echo "No network connections found"
    
    echo "You can try running the API in foreground mode to see all output:"
    echo "  ./scripts/start_api.sh --foreground"
else
    echo "Process $PID is listening on the following ports:"
    echo "$PORTS"
    
    # Try to connect to each port
    for PORT in $PORTS; do
        echo "Testing connection to port $PORT..."
        curl -s "http://localhost:$PORT/api/health" && echo " - Connection successful" || echo " - Connection failed"
    done
    
    # Update the .env file with the actual port
    FIRST_PORT=$(echo "$PORTS" | head -1)
    echo "Updating .env file with port $FIRST_PORT..."
    cd ..
    if grep -q "API_PORT=" .env; then
        sed -i.bak "s/API_PORT=.*/API_PORT=$FIRST_PORT/" .env
        echo "Updated API_PORT in .env file to $FIRST_PORT."
    else
        echo "API_PORT=$FIRST_PORT" >> .env
        echo "Added API_PORT=$FIRST_PORT to .env file."
    fi
fi

echo "You can try to manually check the API health with:"
echo "curl http://localhost:3001/api/health"
echo "Or try other ports if the API is running on a different port."