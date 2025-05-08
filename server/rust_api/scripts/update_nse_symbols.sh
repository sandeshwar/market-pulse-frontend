#!/bin/bash
# Script to manually trigger the update of NSE symbols

echo "Triggering NSE symbols update..."
curl -X GET "http://localhost:3001/api/symbols/upstox/update"
echo -e "\nDone!"