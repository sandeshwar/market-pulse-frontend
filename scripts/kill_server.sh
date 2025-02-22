#!/bin/bash

# Find the process ID running on port 3000 (assuming default Node port)
pid=$(lsof -t -i:3000)

if [ -z "$pid" ]; then
    echo "No process found running on port 3000"
    exit 0
fi

echo "Killing process with PID: $pid"
kill -9 $pid
echo "Server process killed successfully"