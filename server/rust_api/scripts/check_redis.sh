#!/bin/bash

# Script to check if Redis is running and start it if needed

# Check if Redis is running
echo "Checking if Redis is running..."
if redis-cli ping > /dev/null 2>&1; then
    echo "Redis is running."
else
    echo "Redis is not running. Attempting to start Redis..."
    
    # Check if Redis is installed via Homebrew
    if command -v brew > /dev/null && brew list redis > /dev/null 2>&1; then
        echo "Starting Redis using Homebrew services..."
        brew services start redis
        sleep 2
        
        # Check again if Redis is running
        if redis-cli ping > /dev/null 2>&1; then
            echo "Redis started successfully."
        else
            echo "Failed to start Redis using Homebrew services."
            echo "Please start Redis manually or check your installation."
            exit 1
        fi
    else
        echo "Redis is not installed via Homebrew or could not be started."
        echo "Please install Redis or start it manually."
        echo "You can install Redis using: brew install redis"
        exit 1
    fi
fi

# Check Redis connection using the URL from .env
if [ -f ../.env ]; then
    REDIS_URL=$(grep REDIS_URL ../.env | cut -d '=' -f2)
    if [ -n "$REDIS_URL" ]; then
        echo "Testing Redis connection using URL from .env: $REDIS_URL"
        
        # Extract host and port from Redis URL
        if [[ $REDIS_URL =~ redis://([^:]+):([0-9]+) ]]; then
            REDIS_HOST=${BASH_REMATCH[1]}
            REDIS_PORT=${BASH_REMATCH[2]}
            
            echo "Connecting to Redis at $REDIS_HOST:$REDIS_PORT..."
            if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
                echo "Successfully connected to Redis at $REDIS_HOST:$REDIS_PORT"
            else
                echo "Failed to connect to Redis at $REDIS_HOST:$REDIS_PORT"
                echo "Please check your Redis configuration."
                exit 1
            fi
        else
            echo "Could not parse Redis URL: $REDIS_URL"
            echo "Using default connection instead."
            
            if redis-cli ping > /dev/null 2>&1; then
                echo "Successfully connected to Redis using default connection."
            else
                echo "Failed to connect to Redis using default connection."
                exit 1
            fi
        fi
    else
        echo "No REDIS_URL found in .env file. Using default connection."
        
        if redis-cli ping > /dev/null 2>&1; then
            echo "Successfully connected to Redis using default connection."
        else
            echo "Failed to connect to Redis using default connection."
            exit 1
        fi
    fi
else
    echo "No .env file found. Using default Redis connection."
    
    if redis-cli ping > /dev/null 2>&1; then
        echo "Successfully connected to Redis using default connection."
    else
        echo "Failed to connect to Redis using default connection."
        exit 1
    fi
fi

echo "Redis check completed successfully."