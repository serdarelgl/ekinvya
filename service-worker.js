const CACHE_NAME = "ekinvya-shell-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./aydinlatma.html",
  "./styles.css",
  "./app.js",
  "./field-map.js",
  "./auth.js",
  "./supabase-config.js",
  "./cloud-storage.js",
  "./vendor/supabase.min.js",
  "./manifest.webmanifest",
  "./favicon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("ekinvya-shell-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return await caches.match(request)
        || (request.mode === "navigate" ? await caches.match("./index.html") : Response.error());
    }
  })());
});
