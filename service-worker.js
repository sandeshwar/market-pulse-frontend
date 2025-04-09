// Service worker for Market Pulse extension - No caching

// Install event - just skip waiting
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  self.skipWaiting();
});

// Activate event - clean up any existing caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  // Clear all caches to ensure no stale data
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Service Worker: Clearing Cache', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch event - handle requests with no caching
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

  // For all requests, go straight to network without any caching
  event.respondWith(fetch(event.request));
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));