/* eslint-disable no-restricted-globals */
const CACHE_PREFIX = 'chatgpt-web';
const CACHE_VERSION_PLACEHOLDER = '__CACHE_VERSION__';
const CACHE_VERSION = CACHE_VERSION_PLACEHOLDER === '__CACHE_VERSION__' ? 'dev' : CACHE_VERSION_PLACEHOLDER;
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const OFFLINE_URL = 'offline.html';
const PRECACHE_MANIFEST_PLACEHOLDER = '__PRECACHE_MANIFEST__';
const PRECACHE_URLS = (() => {
  try {
    const parsed = JSON.parse(PRECACHE_MANIFEST_PLACEHOLDER);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    console.warn('[sw] Falling back to default precache manifest:', error);
  }
  return [OFFLINE_URL];
})();

const RUNTIME_CACHEABLE_REQUEST = ({ request }) => {
  if (request.method !== 'GET') {
    return false;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }
  if (url.pathname === '/sw.js') {
    return false;
  }
  return true;
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const urlsToCache = Array.from(new Set([...PRECACHE_URLS, OFFLINE_URL]));
      await cache.addAll(urlsToCache);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const deletions = keys
        .filter((cacheKey) => cacheKey.startsWith(`${CACHE_PREFIX}-`) && cacheKey !== CACHE_NAME)
        .map((cacheKey) => caches.delete(cacheKey));
      await Promise.all(deletions);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(handleAssetRequest(request));
});

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch((error) => {
        console.warn('[sw] Unable to update navigation cache', error);
      });
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const offlineResponse = await caches.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }
    return new Response('You appear to be offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function handleAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  if (!RUNTIME_CACHEABLE_REQUEST({ request })) {
    return fetch(request);
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok && networkResponse.type !== 'opaque') {
      cache.put(request, networkResponse.clone()).catch((error) => {
        console.warn('[sw] Failed to cache response for', request.url, error);
      });
    }
    return networkResponse;
  } catch (error) {
    if (request.destination === 'document') {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    throw error;
  }
}
