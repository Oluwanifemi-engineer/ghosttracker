/**
 * Magneetar PWA Service Worker
 * Provides offline support and caching for the dashboard.
 */

const CACHE_NAME = 'magneetar-v3';
const STATIC_CACHE = 'magneetar-static-v3';
const DYNAMIC_CACHE = 'magneetar-dynamic-v3';

// Assets to cache on install. NOTE: /download is deliberately EXCLUDED —
// its APK ticket logic must always come from the latest bundle, and a stale
// cached copy of it broke the download button for clients running the old
// service worker (the button looped back to the page). Network-first on
// navigations serves it fresh instead.
const STATIC_ASSETS = [
  '/',
  '/login',
  '/signup',
  '/favicon.svg',
  '/logo.svg',
  '/m-logo.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, OPTIONS, etc.) — they must go to network
  if (request.method !== 'GET') {
    return;
  }

  // Skip ALL cross-origin requests (trust page calls api.magneetar.me directly)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip API calls and WebSocket
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // Network-first strategy for HTML pages
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200) {
              return response;
            }

            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });

            return response;
          });
      })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
