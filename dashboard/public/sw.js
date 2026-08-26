/**
 * Magneetar PWA Service Worker v5
 *
 * Key change: _next/static/* chunks use NETWORK-ONLY strategy.
 * Previous versions used stale-while-revalidate which caused intermittent
 * crashes when old cached JS referenced module IDs that changed in new builds.
 * Next.js already uses content-hashed filenames, so HTTP caching handles
 * freshness — the SW doesn't need to cache these at all.
 */

const CACHE_VERSION = 'v6';
const STATIC_CACHE = `magneetar-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `magneetar-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/login',
  '/signup',
  '/favicon.svg',
  '/m-logo.svg',
  '/magneetar-mhalf.svg',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v5...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v5 — purging ALL old caches');
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (api.magneetar.me, tiles, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API and WebSocket calls
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;

  // *** NETWORK-ONLY for _next/static JS/CSS chunks ***
  // This prevents stale cached JS from crashing the app after a new deploy.
  // Next.js content-hashed filenames + browser HTTP cache handle freshness.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for HTML navigations
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Cache-first for other static assets (images, fonts, SVGs)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
