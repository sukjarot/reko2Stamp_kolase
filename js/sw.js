const CACHE_NAME = 'reko2stamp.kolase-v4';
const APP_ROOT = new URL(self.registration.scope || './', self.location.href);

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/canvas-utils.js',
  './js/camera.js',
  './js/location.js',
  './js/storage.js',
  './manifest.json',
  './icon ultimate 2.png'
];


const NETWORK_ONLY_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'fonts.cdnfonts.com',
  'unpkg.com',
  'tile.openstreetmap.org',
  'www.openstreetmap.org',
  'nominatim.openstreetmap.org',
  'us1.locationiq.com'
];

function appUrl(path) {
  return new URL(path, APP_ROOT).toString();
}

function isNetworkOnly(url) {
  return NETWORK_ONLY_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(ASSETS_TO_CACHE.map(appUrl));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function navigationFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return caches.match(appUrl('./index.html'));
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(cacheAppShell());
});

// Listen to messages from the page (used to trigger skipWaiting from client)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || isNetworkOnly(url)) {
    return;
  }

  if (url.origin === APP_ROOT.origin && url.pathname.endsWith('/icon ultimate.png')) {
    event.respondWith(caches.match(appUrl('./icon ultimate 2.png')).then((cached) => cached || fetch(request)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
