# Market Pulse API Scripts

This directory contains scripts for running, managing, and troubleshooting the Market Pulse API.

## Main Scripts

### `start_api.sh`

The primary script for starting and managing the API. It handles Redis checks, data directory creation, and API startup.

#### Usage

```bash
# Basic usage (starts API in background)
./start_api.sh

# Run in foreground mode
./start_api.sh --foreground

# Use a different port
./start_api.sh --port 3002

# Skip the build step
./start_api.sh --skip-build

# Show help
./start_api.sh --help
```

### `run_api_foreground.sh`

A simplified script to run the API in the foreground with debug logging.

```bash
# Basic usage
./run_api_foreground.sh

# Use a different port
./run_api_foreground.sh --port 3002
```

### `check_api_health.sh`

A diagnostic script that checks the health of the API and verifies if symbols are loaded correctly.

```bash
# Basic usage
./check_api_health.sh

# Connect to a different host
./check_api_health.sh --host localhost:3002
```

### `find_api_port.sh`

A script to find which port the API is running on, useful when the API is running but not on the expected port.

```bash
# Basic usage
./find_api_port.sh
```

This script will:
- Find any running Market Pulse API processes
- Check which ports they are listening on
- Test the connection to each port
- Update the .env file with the correct port if found

## Utility Scripts

### `check_redis.sh`

Checks if Redis is running and attempts to start it if it's not.

```bash
./check_redis.sh
```

### `initialize_symbols.sh`

Initializes symbols in the API if none are loaded.

```bash
# Basic usage
./initialize_symbols.sh

# Connect to a different host
./initialize_symbols.sh --host localhost:3002
```

### `fetch_symbols_by_range.sh`

Fetches symbols by range from the API, useful for inspecting the symbol collection.

```bash
# Basic usage (fetches symbols from index 0 to 100)
./fetch_symbols_by_range.sh

# Fetch symbols from index 100 to 200
./fetch_symbols_by_range.sh --start 100 --end 200

# Output as CSV
./fetch_symbols_by_range.sh --format csv
```

### `make_scripts_executable.sh`

Makes all scripts executable.

```bash
./make_scripts_executable.sh
```

## Quick Start

1. Make all scripts executable:
   ```bash
   chmod +x make_scripts_executable.sh
   ./make_scripts_executable.sh
   ```

2. Start the API:
   ```bash
   ./start_api.sh
   ```

3. Check the API health:
   ```bash
   ./check_api_health.sh
   ```

## Troubleshooting

If you're experiencing issues with the API:

1. **API won't start**:
   - Check if Redis is running: `./check_redis.sh`
   - Try running in foreground mode to see errors: `./start_api.sh --foreground`
   - Try a different port: `./start_api.sh --port 3002`

2. **No symbols loaded**:
   - Initialize symbols: `./initialize_symbols.sh`
   - Check the data directory exists: `ls -la ../data`
   - Check Redis connection: `redis-cli ping`

3. **Multiple binaries error**:
   - Use the `--bin` option: `cargo run --bin market_pulse_api`
   - Or use our scripts which already specify the correct binary

4. **Port already in use**:
   - Use a different port: `./start_api.sh --port 3002`
   - Or kill the process using the port: `kill $(lsof -t -i :3001)`