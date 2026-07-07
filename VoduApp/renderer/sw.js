const CACHE = 'allufy-v1';
const URLS = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json', '/icon-pwa-192.svg', '/icon-pwa-512.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.startsWith('http')) {
    e.respondWith(
      caches.match(e.request).then((c) => c || fetch(e.request).then((r) => {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('text') || ct.includes('image') || ct.includes('javascript') || ct.includes('css')) {
          const cp = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, cp));
        }
        return r;
      }))
    );
  }
});
