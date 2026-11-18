/*
 * RDbookingMS - service worker (install-as-app + fast repeat visits).
 * BUILD and ASSETS are filled in by update-web.cjs; do not edit those two lines by hand.
 *
 *  - The page itself (index.html) is fetched fresh whenever the internet answers within 4 seconds,
 *    so updates show up on the next visit. If the connection is slow or down, the saved copy opens.
 *  - app.css / app.js / gas-bridge.js carry a version (?v=...) and are kept until the next update.
 *  - Calls to the booking server (script.google.com) are never cached or touched.
 */
const BUILD = '322f21fe5f';
const ASSETS = ["./","app.css?v=528dc0b303","app.js?v=d2dd834a22","gas-bridge.js?v=1b45ec2dd1","config.js","terms.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png","favicon-32.png"];
const CACHE = 'rdb-' + BUILD;
const RUNTIME = 'rdb-runtime';
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('rdb-') && k !== CACHE && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function pageKey(url) { return /\/(index\.html)?$/.test(url.pathname) ? './' : url.pathname.replace(/^.*\//, ''); }

function networkFirst(request, key, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const fallback = () => caches.match(key, { ignoreSearch: true }).then(r => r || caches.match('./'));
    const timer = timeoutMs ? setTimeout(() => {
      fallback().then(r => { if (r && !settled) { settled = true; resolve(r); } });
    }, timeoutMs) : null;
    fetch(request).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      fallback().then(r => { if (!settled) { settled = true; clearTimeout(timer); resolve(r || Response.error()); } });
    });
  });
}

function cacheFirst(request, cacheName) {
  return caches.match(request).then(hit => hit || fetch(request).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(cacheName).then(c => c.put(request, copy)); }
    return res;
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                                   // server calls are POST: untouched
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { event.respondWith(networkFirst(req, pageKey(url), 4000)); return; }
    if (url.searchParams.has('v')) { event.respondWith(cacheFirst(req, CACHE)); return; }   // versioned: safe to keep
    event.respondWith(networkFirst(req, url.pathname.replace(/^.*\//, '') || './', 0));    // config.js, icons, ...
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(req, RUNTIME));       // fonts and tools (pinned versions)
  // anything else (script.google.com, Drive images, ...) goes straight to the network
});
