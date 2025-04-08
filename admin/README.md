# Market Pulse API Analytics Dashboard

This is a standalone analytics dashboard for the Market Pulse API. It provides real-time monitoring of API usage, performance metrics, and error tracking.

## Features

- Real-time API request monitoring
- Response time tracking
- Error rate visualization
- Endpoint usage statistics
- Configurable refresh rates

## Usage

1. Start the Market Pulse API server
2. Open `index.html` in your browser
3. The dashboard will automatically connect to the API and display analytics data

## Development

The dashboard is built with vanilla JavaScript and Chart.js. It's designed to be lightweight and easy to modify.

### Files

- `index.html` - Main dashboard page
- `css/` - Stylesheets
- `js/` - JavaScript files
- `js/dashboard.js` - Dashboard component
- `js/analyticsService.js` - Service for fetching analytics data

## Configuration

You can configure the API URL in the `index.html` file:

```javascript
// Set API base URL
window.API_BASE_URL = 'http://localhost:3001';
```

Change this to match your API server's address.