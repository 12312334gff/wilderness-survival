/* 荒野余生 · 离线缓存（2D + 3D 都缓存） */
var CACHE = 'wilderness-v2';
var FILES = [
  './',
  './start.html',
  './explore.html',
  './index.html',
  './css/style.css',
  './css/game.css',
  './js/data.js',
  './js/game.js',
  './js/audio.js',
  './js/ui.js',
  './js3d/world-data.js',
  './js3d/main.js',
  './js3d/overlay.js',
  './vendor/three.module.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return c.add(f).catch(function () { /* 单个失败不影响其他 */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return res;
      }).catch(function () {
        return caches.match('./start.html');
      });
    })
  );
});