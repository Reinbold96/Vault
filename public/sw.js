/* Service Worker der Vault-PWA.
   Wichtig fuer iOS: eine als Web-App installierte Seite wird oft nur aus dem
   Hintergrund fortgesetzt statt neu gestartet. Wird dann index.html aus dem Cache
   beantwortet, zeigt die App auf Dauer alte Asset-URLs. Darum:
     - Dokumente/Manifest: network-first (Cache nur als Offline-Reserve)
     - gehashte Assets: cache-first (Dateiname aendert sich bei jedem Build)
   API-Aufrufe (Kurse, Logos) laufen immer direkt ins Netz. */
const CACHE = "vault-v5";
const DOC_FALLBACK = "./index.html";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Fetch ohne HTTP-Cache: GitHub Pages setzt max-age=600, sonst kann der Browser
   bis zu 10 Minuten lang eine alte index.html liefern. */
const fetchFresh = (req) => {
  try {
    return fetch(new Request(req.url, { cache: "reload", credentials: "same-origin" }));
  } catch {
    return fetch(req);
  }
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // externe APIs nicht anfassen

  const isDoc =
    req.mode === "navigate" ||
    req.destination === "document" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".webmanifest");

  if (isDoc) {
    e.respondWith(
      fetchFresh(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            /* Neue index.html = neuer Build: alte, nicht mehr referenzierte
               Assets aus dem Cache werfen, sonst waechst er mit jedem Deploy. */
            if (req.destination === "document" || req.mode === "navigate") {
              e.waitUntil(res.clone().text().then(pruneAssets).catch(() => {}));
            }
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(DOC_FALLBACK)))
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
  );
});

/* Cache-Bereinigung: Der Dateiname des Einstiegs-Bundles (assets/app-<hash>.js)
   identifiziert einen Build. Aendert er sich gegenueber dem gemerkten Wert, war ein
   Deploy – dann werden alle assets/*-Eintraege geloescht, die die neue index.html
   nicht referenziert (Lazy-Chunks des neuen Builds werden bei Bedarf neu geladen). */
const BUILD_MARK = "/__vault_build__";
async function pruneAssets(html) {
  const referenced = new Set();
  for (const m of html.matchAll(/assets\/[\w.-]+/g)) referenced.add(m[0]);
  const entry = [...referenced].find((n) => /^assets\/app-[\w-]+\.js$/.test(n));
  if (!entry) return;
  const cache = await caches.open(CACHE);
  const markRes = await cache.match(BUILD_MARK);
  const prev = markRes ? await markRes.text() : "";
  if (prev === entry) return; /* gleicher Build – nichts zu tun */
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    const i = path.indexOf("assets/");
    if (i < 0) continue;
    if (!referenced.has(path.slice(i))) await cache.delete(req);
  }
  await cache.put(BUILD_MARK, new Response(entry, { headers: { "content-type": "text/plain" } }));
}

/* Die Seite kann ein sofortiges Update anstossen */
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
