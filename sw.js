// Sailo service worker: keeps the app shell and its libraries cached so the sea appears
// immediately on reload and the app still opens on a weak or missing connection.
// App files are network-first (so a deploy shows up right away); pinned CDN libraries are
// cache-first; live data (maps, weather, Supabase) is never cached here.
const VERSION = 'sailo-v1';
const SHELL = ['./', './index.html', './Living%20Ocean.dc.html', './support.js', './ocean-objects.js', './sailo-voyage.js', './favicon.svg'];
const LIBS = /^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net|api\.mapbox\.com\/mapbox-gl-js|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => { }).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/') || url.pathname === '/config.js' || url.pathname.endsWith('/config.js')) return; // always live
    e.respondWith(timeout(fetch(req), 4000).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./Living%20Ocean.dc.html'))));
    return;
  }
  if (LIBS.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; }); return hit || net; }));
  }
});

self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => { for (const w of ws) if ('focus' in w) return w.focus(); return self.clients.openWindow('./'); })); });
