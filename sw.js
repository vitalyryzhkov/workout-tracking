// Тренировки — service worker
const CACHE = "strength-v10";        // оболочка приложения (бампай при каждом релизе)
const MEDIA = "exercise-media-v1";   // гифки/превью — отдельный кэш, переживает обновления оболочки
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== MEDIA).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // чужие источники не перехватываем
  if (url.origin !== self.location.origin) return;

  // медиа упражнений (videos/ и images/): cache-first в отдельном долговечном кэше
  if (url.pathname.includes("/videos/") || url.pathname.includes("/images/")) {
    e.respondWith(
      caches.open(MEDIA).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    // network-first: свежий index.html при сети, кэш — офлайн
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(h => h || caches.match("./index.html")))
    );
    return;
  }

  // прочие свои ресурсы (иконки, manifest): cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
