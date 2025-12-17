// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  ⚠️  IMPORTANTE: ACTUALIZAR VERSIÓN EN CADA MODIFICACIÓN DEL CÓDIGO  ⚠️   ║
// ╠═══════════════════════════════════════════════════════════════════════════╣
// ║  Para que la PWA se actualice correctamente, DEBES cambiar la versión en:║
// ║                                                                           ║
// ║  1. sw.js (línea siguiente) → 'control-voltes-cache-vX.X.X'             ║
// ║  2. manifest.json → "version": "X.X.X"                                   ║
// ║  3. index.html → scripts.js?v=X.X.X y styles.css?v=X.X.X                ║
// ║  4. scripts.js → const appVersion = 'X.X.X' (línea ~5429)               ║
// ║                                                                           ║
// ║  📌 NOTA PARA ASISTENTE IA:                                              ║
// ║  Después de CUALQUIER cambio de código, PREGUNTA al usuario:            ║
// ║  "¿Quieres actualizar la versión para forzar actualización de la app?"  ║
// ║                                                                           ║
// ║  VERSIÓN ACTUAL: 2.0.0                                                   ║
// ║  PRÓXIMA VERSIÓN: 2.0.1 (incrementar al hacer cambios)                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const CACHE_NAME = 'control-voltes-cache-v2.0.0';

// Detectar si estamos en GitHub Pages o local
const isGitHubPages = self.location.hostname.includes('github.io');
const basePath = isGitHubPages ? '/ControlVoltes' : '';

const URLS_TO_CACHE = [
  `${basePath}/`,
  `${basePath}/index.html`,
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
  
  // Network First para archivos principales de la app
  const isAppFile = url.pathname.endsWith('.html') || 
                    url.pathname.endsWith('.js') || 
                    url.pathname.endsWith('.css') || 
                    url.pathname.endsWith('.json');
  
  if (isAppFile) {
    // Network First: intenta red primero, caché como fallback
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    // Cache First para otros recursos (imágenes, iconos, etc.)
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
