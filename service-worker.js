// Service worker for Market Pulse extension
const CACHE_NAME = 'market-pulse-v2';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch event - handle CORS requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle CORS requests to luminera.ai API
  if (url.hostname === 'luminera.ai') {
    // Clone the request to add the API key header if needed
    const modifiedRequest = new Request(event.request, {
      headers: new Headers(event.request.headers),
      mode: 'cors' // Ensure CORS mode is set
    });
    
    event.respondWith(
      fetch(modifiedRequest)
        .catch(error => {
          console.error('Fetch error:', error);
          return new Response(JSON.stringify({ error: 'Network error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Handle all other requests
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));