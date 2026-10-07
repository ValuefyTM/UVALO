/**
 * Service worker of /localizare (registered with scope /localizare). Keeps on the phone the page, its scripts,
 * the plans of the localities already opened and the map images already seen, so the map opens with a weak signal
 * or none. Fresh data is fetched whenever there is signal. A 401 (password needed) is never kept.
 */
const SW = `
const V = "vf-loc-v1", TILES = "vf-loc-tiles-v2", MAX_TILES = 4000;
const PAGE = "/localizare";

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("vf-loc-") && k !== V && k !== TILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isTile = (u) => /arcgisonline\\.com|tile\\.openstreetmap\\.org/.test(u.hostname);
const isLib = (u) => u.hostname === "cdnjs.cloudflare.com" || u.hostname === "cdn.jsdelivr.net" || u.hostname === "unpkg.com";
const isData = (u) => u.origin === location.origin && (u.pathname.startsWith("/api/localizare/data/") || u.pathname === "/api/localizare/script" || u.pathname === "/api/localizare/track-js");
const isStatic = (u) => u.origin === location.origin && (u.pathname.startsWith("/_next/static/") || /^\\/(loc-icon|valuefy-logo|icon)/.test(u.pathname) || u.pathname === "/api/localizare/manifest");

async function trim() {
  const c = await caches.open(TILES); const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);

  // The page: network first (password check, new version), the saved copy without signal.
  if (req.mode === "navigate" && u.origin === location.origin && u.pathname === PAGE) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(V)).put(PAGE, res.clone());
        return res;
      } catch {
        return (await caches.match(PAGE)) || new Response("<p style='font-family:sans-serif;padding:24px'>Fără semnal. Deschide pagina o dată cu internet ca să poată fi folosită și offline.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  // Plans of the localities and the export script: saved copy right away, refreshed in the background.
  if (isData(u)) {
    e.respondWith((async () => {
      const c = await caches.open(V); const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response("{}", { status: 503, headers: { "Content-Type": "application/json" } });
    })());
    return;
  }
  // Libraries and icons do not change.
  if (isLib(u) || isStatic(u)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === "opaque") caches.open(V).then((c) => c.put(req, res.clone())); return res; })));
    return;
  }
  // Map images: the ones already seen stay on the phone (at most ${"$"}{MAX_TILES}).
  if (isTile(u)) {
    e.respondWith((async () => {
      const c = await caches.open(TILES); const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") { c.put(req, res.clone()); if (Math.random() < 0.02) e.waitUntil(trim()); }
        return res;
      } catch { return new Response("", { status: 504 }); }
    })());
  }
});
`;

export function GET() {
  return new Response(SW, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/localizare", "X-Robots-Tag": "noindex" },
  });
}
