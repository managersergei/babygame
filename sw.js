/* Офлайн-кэш: страницы — сеть, потом кэш; ассеты — кэш, потом сеть. Версию менять при выкатке. */
var VER = 'bg-2026-09-09a';
var CORE = ['./', 'index.html', 'pult.html', 'manifest.json', 'assets/voice/list.js', 'assets/paths.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  if (u.pathname.indexOf('/assets/') >= 0 || u.pathname.indexOf('/icons/') >= 0) {
    e.respondWith(caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (res) {
        if (res.ok) { var cp = res.clone(); caches.open(VER).then(function (c) { c.put(e.request, cp); }); }
        return res;
      });
    }));
    return;
  }
  e.respondWith(fetch(e.request).then(function (res) {
    if (res.ok) { var cp = res.clone(); caches.open(VER).then(function (c) { c.put(e.request, cp); }); }
    return res;
  }).catch(function () { return caches.match(e.request); }));
});
