// ============================================================
// SERVICE WORKER — FIFA World Cup 2026 Live Tracker
// Cache : Network-first pour API, Cache-first pour assets
// ============================================================
const CACHE = 'wc2026-v3';
const STATIC = [
  './coupe_du_monde_2026_tf1.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(STATIC.map(url => c.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API football + Claude → réseau uniquement, jamais caché
  if (url.hostname.includes('api-sports') || url.hostname.includes('anthropic') || url.hostname.includes('rapidapi')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ errors: { offline: 'Hors ligne' }, response: [] }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Google Fonts → Cache first
  if (url.hostname.includes('fonts.g') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }

  // App HTML + assets → Network first, fallback cache
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
