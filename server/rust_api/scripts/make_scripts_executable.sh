#!/bin/bash

# Make all shell scripts executable
find "$(dirname "$0")" -name "*.sh" -exec chmod +x {} \;

echo "All scripts are now executable."
echo
echo "Main scripts:"
echo "  ./scripts/start_api.sh         - Start the API (with options for foreground/background)"
echo "  ./scripts/run_api_foreground.sh - Run the API in foreground mode"
echo "  ./scripts/check_api_health.sh  - Check if the API is running correctly"
echo "  ./scripts/find_api_port.sh     - Find which port the API is running on"
echo
echo "Utility scripts:"
echo "  ./scripts/check_redis.sh       - Check if Redis is running"
echo "  ./scripts/initialize_symbols.sh - Initialize symbol data"
echo "  ./scripts/fetch_symbols_by_range.sh - Fetch symbols by range (for troubleshooting)"
echo
echo "For help with options:"
echo "  ./scripts/start_api.sh --help"