/* Service worker – töötab ilma internetita.
 * Strateegia: võrk enne (3 s ooteaeg) → uuendab vahemälu; võrguta → vahemälust.
 * Nii jõuab uus versioon kohale kohe, kui seade on Wi-Fi-s, ja offline töötab alati. */
var CACHE = 'autoapp-0.4.0';
var FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
var TIMEOUT = 3000;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function fromCache() {
      if (done) return; done = true;
      caches.match(req, { ignoreSearch: true }).then(function (r) {
        resolve(r || new Response('Offline', { status: 503 }));
      });
    }
    var timer = setTimeout(fromCache, TIMEOUT);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      if (!done) { done = true; resolve(res); }
    }).catch(function () { clearTimeout(timer); fromCache(); });
  }));
});
