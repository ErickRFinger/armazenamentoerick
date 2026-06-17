const CACHE_NAME = 'security-cache-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/icon.svg',
  'https://unpkg.com/@phosphor-icons/web',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    // Não colocar APIs em cache, sempre tentar rede
    event.respondWith(fetch(event.request));
  } else {
    // Usar cache para os arquivos estáticos se a rede falhar
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
