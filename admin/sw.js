/*
 * RDbookingMS - License Admin service worker (lets the Admin panel be installed as an app).
 * The Admin page is always loaded fresh from the internet; the last good copy is kept only so the installed app
 * still opens (and shows its sign-in) when the connection drops. Calls to the License Admin server, Google sign-in
 * and every other request are never cached or touched. No client data is ever stored here.
 */
const CACHE = 'rdadm-shell-v1';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('rdadm-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;          // only the Admin page itself
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); }
    return res;
  }).catch(() => caches.match('./').then(r => r || Response.error())));
});
