/*
 * Service worker: lets the installed app open offline.
 * Network first, so visitors always get the latest version when online;
 * the cached copy is used only when the network is unavailable.
 */
var CACHE = "schengen-90-180-v45";
var SHELL = [
  "./",
  "index.html",
  "css/style.css",
  "js/theme.js",
  "js/scheme.js",
  "js/calc.js",
  "js/export.js",
  "js/app.js",
  "js/install.js",
  "manifest.webmanifest",
  "favicon.ico",
  "icons/favicon-32.png",
  "icons/icon-150.png",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match("index.html");
      });
    })
  );
});
