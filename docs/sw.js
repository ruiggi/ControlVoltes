// Versión de caché: importada desde version.js (generado desde app-version.json).
importScripts('version.js');

const CACHE_NAME = `control-voltes-cache-v${APP_VERSION}`;

const isGitHubPages = self.location.hostname.includes('github.io');
const basePath = isGitHubPages ? '/ControlVoltes' : '';

const URLS_TO_CACHE = [
  `${basePath}/`,
  `${basePath}/index.html`,
  `${basePath}/version.js`,
  `${basePath}/styles.css`,
  `${basePath}/scripts.js`,
  `${basePath}/manifest.json`,
  `${basePath}/icons/crono-512.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isAppFile = url.pathname.endsWith('.html') ||
                    url.pathname.endsWith('.js') ||
                    url.pathname.endsWith('.css') ||
                    url.pathname.endsWith('.json');

  if (isAppFile) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached))
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
