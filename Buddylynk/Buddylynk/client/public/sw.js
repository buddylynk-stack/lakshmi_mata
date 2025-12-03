// Buddylynk Service Worker for fast loading
const CACHE_NAME = 'buddylynk-v1';
const STATIC_CACHE = 'buddylynk-static-v1';
const MEDIA_CACHE = 'buddylynk-media-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore errors during install
        console.log('Some assets failed to cache during install');
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== MEDIA_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension, ws, wss protocols
  if (!url.protocol.startsWith('http')) return;

  // Skip API requests - always fetch fresh
  if (url.pathname.startsWith('/api/')) return;

  // Skip socket.io requests
  if (url.pathname.startsWith('/socket.io/')) return;

  // Skip HMR/Vite dev server requests
  if (url.pathname.includes('/@') || url.pathname.includes('__vite')) return;

  // Handle media files (images, videos from S3)
  if (url.hostname.includes('s3.amazonaws.com') || 
      url.hostname.includes('cloudfront.net') ||
      request.destination === 'image' ||
      request.destination === 'video') {
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached, but update in background
            fetch(request).then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }
          // Not in cache, fetch and cache
          return fetch(request).then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => {
            // Return nothing if fetch fails
            return new Response('', { status: 408, statusText: 'Request Timeout' });
          });
        });
      }).catch(() => fetch(request))
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return new Response('', { status: 408, statusText: 'Request Timeout' });
        });
      })
    );
    return;
  }

  // Default: network first, cache fallback for navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
  }
});
