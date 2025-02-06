# Market Pulse Chrome Extension (Frontend)

A powerful Chrome extension designed to track market trends and insights directly from your browser. This repository contains the frontend implementation of the Market Pulse extension.

## Features

- **Side Panel Integration**: Seamlessly integrates with Chrome's side panel for easy access to market information
- **Responsive UI**: Collapsible panel design that adapts to your browsing needs
- **Real-time Market Tracking**: Monitor market trends as you browse (requires backend connection)
- **Modern Interface**: Clean and intuitive user interface built with modern web technologies

## Project Structure

```
src/
├── components/       # UI components
├── styles/          # Global and component-specific styles
├── utils/           # Utility functions and helpers
├── vendor/          # Third-party dependencies
└── main.js          # Application entry point
```

## Technical Details

- Built using Chrome Extension Manifest V3
- Implements modern JavaScript practices
- Uses a modular component-based architecture
- Features a service worker for background operations

## Installation

As this is a development version, the extension needs to be loaded unpacked:

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `frontend` directory

## Development

This extension is built with:
- Vanilla JavaScript (ES6+)
- HTML5
- CSS3
- Chrome Extension APIs

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
- activeTab
- sidePanel

## License

All rights reserved. This is a proprietary software.

---
*Last Updated: January 10, 2025*
