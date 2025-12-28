const CACHE_NAME = 'antalyahal-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const url = new URL(req.url);

      // Network-first for navigation
      if (req.mode === 'navigate') {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match('./index.html');
          return cached || Response.error();
        }
      }

      // Cache-first for same-origin static
      if (url.origin === self.location.origin) {
        const cached = await caches.match(req);
        if (cached) return cached;

        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          return Response.error();
        }
      }

      // For cross-origin (CDNs), just pass through
      return fetch(req);
    })()
  );
});
