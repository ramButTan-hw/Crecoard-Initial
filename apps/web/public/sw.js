// Minimal, conservative service worker: enough to make Crecoard installable and
// give an offline fallback, without caching Next's hashed chunks (which would risk
// serving stale JS). Only navigations are intercepted — everything else passes
// straight to the network.
const CACHE = "crecoard-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Network-first for page navigations; show the offline page only when the network
  // is unreachable. Static assets and API calls are left to the browser/network.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
