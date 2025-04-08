#!/bin/bash

# Start the admin dashboard

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Go to the project root directory
cd "$SCRIPT_DIR/.."

# Check if the API server is running
API_PORT=${API_PORT:-3001}
if ! nc -z localhost $API_PORT &>/dev/null; then
  echo "Warning: API server doesn't seem to be running on port $API_PORT"
  echo "The dashboard will not display any data until the API server is started."
  echo ""
 fi

# Start a simple HTTP server for the admin dashboard
echo "Starting admin dashboard on http://localhost:8080"
echo "Press Ctrl+C to stop"

# Use Python's built-in HTTP server
if command -v python3 &>/dev/null; then
  cd admin && python3 -m http.server 8080
elif command -v python &>/dev/null; then
  cd admin && python -m SimpleHTTPServer 8080
else
  echo "Error: Python is not installed. Please install Python or use another HTTP server."
  exit 1
fi