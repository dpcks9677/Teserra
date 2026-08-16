const CACHE_VERSION = '__BUILD_ID__';
const CORE_CACHE = `augmented-dice-core-${CACHE_VERSION}`;
const ASSET_CACHE = `augmented-dice-assets-${CACHE_VERSION}`;
const CACHE_PREFIX = 'augmented-dice-';
const ASSET_PATH = /^\/(?:textures|models|presets|sounds|assets)\//;

async function loadManifest() {
  const response = await fetch('/precache-manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
  return response.json();
}

function canCache(pathname, response) {
  if (response.status !== 200 || response.type === 'opaque') return false;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) return false;
  if (pathname.endsWith('.json')) return contentType.includes('application/json');
  return true;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (canCache(new URL(request.url).pathname, response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CORE_CACHE);
    return (await cache.match('/index.html')) || Response.error();
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const manifest = await loadManifest();
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll(manifest.files);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const activeCaches = new Set([CORE_CACHE, ASSET_CACHE]);
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && !activeCaches.has(name))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, CORE_CACHE));
  } else if (ASSET_PATH.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
