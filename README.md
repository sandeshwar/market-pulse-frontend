# Market Pulse Chrome Extension

A powerful Chrome extension designed to track market trends and insights directly from your browser. This repository contains the React-based implementation of the Market Pulse extension.

## Features

- **Side Panel Integration**: Seamlessly integrates with Chrome's side panel for easy access to market information
- **Responsive UI**: Collapsible panel design that adapts to your browsing needs
- **Real-time Market Tracking**: Monitor market trends as you browse (requires backend connection)
- **Modern Interface**: Clean and intuitive user interface built with React
- **Customizable Watchlists**: Create and manage personalized stock watchlists
- **Breaking News**: Stay updated with the latest market news

## Project Structure

```
src/
├── components/       # React components
│   ├── cards/        # Card components for different data types
│   ├── common/       # Shared UI components
│   └── ExpandedPanel/# Panel and tab components
├── services/         # API and data services
├── styles/           # Global and component-specific styles
├── utils/            # Utility functions and helpers
├── constants/        # Application constants
├── App.jsx           # Main React component
└── main.jsx          # Application entry point

server/
├── rust_api/         # High-performance Rust API
└── data/             # Data files

admin/                # Admin dashboard (separate application)
```

## Technical Details

- Built using Chrome Extension Manifest V3
- Modern React (v18) implementation
- Component-based architecture
- Vite for fast builds and development
- Features a service worker for background operations

## Installation

As this is a development version, the extension needs to be loaded unpacked:

1. Clone this repository
2. Install dependencies: `pnpm install` or `npm install`
3. Build the extension: `pnpm build` or `npm run build`
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the `dist` directory

## Development

This extension is built with:
- React 18
- Modern JavaScript (ES6+)
- CSS3
- Chrome Extension APIs
- Vite build system

### Development Commands

```bash
# Install dependencies
pnpm install

# Development build with watch mode
pnpm dev

# Production build
pnpm build
```

## Admin Dashboard

The project includes a standalone admin dashboard for monitoring API usage and performance:

### Features
- Real-time API request monitoring
- Response time tracking
- Error rate visualization
- Endpoint usage statistics

### Usage
1. Start the Market Pulse API server
2. Navigate to the admin directory: `cd admin`
3. Start the dashboard: `npm start`
4. Open your browser to http://localhost:8080

## Important Notes

- This repository contains only the frontend implementation
- The backend services are maintained in a separate repository
- No external contributions are being accepted at this time

## Version

Current Version: 2.0.0

## Browser Compatibility

- Chrome: Latest version
- Chromium-based browsers: Latest version

## Security

The extension implements strict Content Security Policy (CSP) and requires minimal permissions for optimal security:
- storage
- sidePanel

## License

All rights reserved. This is a proprietary software.

---
*Last Updated: June 2024*
