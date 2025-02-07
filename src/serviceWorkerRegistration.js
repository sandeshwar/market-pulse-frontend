// Register the service worker
export function register() {
  // Chrome extensions don't support service workers in the traditional way
  // Service workers are automatically registered via manifest.json
  console.log('Service worker registration handled by Chrome extension manifest');
}

// Unregister the service worker
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}
