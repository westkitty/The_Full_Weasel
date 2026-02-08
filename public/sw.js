const CACHE_NAME = "full-weasel-v2";
const CORE_PRECACHE = ["/", "/index.html", "/manifest.webmanifest", "/assets/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_PRECACHE))
      .catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function shouldUseCacheFirst(request) {
  if (request.method !== "GET") {
    return false;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  const pathname = url.pathname;
  const isMediaRequest =
    request.destination === "audio" ||
    request.destination === "video" ||
    pathname.endsWith(".mp3") ||
    pathname.endsWith(".mp4");
  if (isMediaRequest) {
    return false;
  }

  return (
    request.mode === "navigate" ||
    request.destination === "script" ||
    request.destination === "style" ||
    pathname.startsWith("/assets/sprites/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/assets/manifest.json"
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === "navigate") {
      const fallback = await cache.match("/");
      if (fallback) {
        return fallback;
      }
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  if (!shouldUseCacheFirst(event.request)) {
    return;
  }
  event.respondWith(cacheFirst(event.request));
});
