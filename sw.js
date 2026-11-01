const CACHE_NAME = 'sankofa-trails-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './images/background.png',
  './images/logo.png',
  './images/logo-mark.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Network first, cache as the fallback: after a new version is pushed, visitors
// get it on their next load instead of a stale copy, and pages and pictures they
// have already opened still work if the signal drops. Audio is left to the
// browser: caching it breaks seeking on iPhones and the files are large.
self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  if(/\.(mp3|m4a|wav|mp4)$/i.test(url.pathname)) return;
  if(req.headers.has('range')) return;

  event.respondWith(
    fetch(req).then(response => {
      if(response && response.ok && response.status === 200){
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return response;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
