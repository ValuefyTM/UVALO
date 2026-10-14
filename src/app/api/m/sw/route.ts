// Service worker of the phone app (served at /sw.js on inspectii.uvalo.ro, scope "/"): the app opens without signal
// (the page and its scripts are kept), the data always goes to the network (answers and photos are queued by the page).
const SW = `const C = "uvalo-insp-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(["/"]).catch(() => {}))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (u.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put(e.request, cp)); return res; })));
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put("/", cp)); return res; }).catch(() => caches.match("/")));
  }
});`;

export function GET() {
  return new Response(SW, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" } });
}
