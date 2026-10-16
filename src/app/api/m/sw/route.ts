// Service worker of the phone app (served at /sw.js on inspectii.uvalo.ro, scope "/"): the app opens at once and without signal
// (the page from memory, refreshed in the background; the scripts are kept), the data always goes to the network (answers and photos are queued by the page);
// it shows the push notifications (/api/m/push, webpush.ts) and opens the inspection when one is tapped.
const SW = `const C = "uvalo-insp-v5";
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
    // the app opens at once from memory (stale-while-revalidate): the page is refreshed in the background for the next start
    // a new page is kept only with its scripts and styles, so the next start (after a deploy) has everything it needs
    const net = fetch(e.request).then((res) => {
      if (res.ok) { const cp = res.clone(); e.waitUntil(cp.text().then((html) => caches.open(C).then((c) => {
        const files = [...new Set((html.match(/\\/_next\\/static\\/[^"'\\s)]+/g) || []))];
        return Promise.all(files.map((f) => c.match(f).then((hit) => hit || c.add(f).catch(() => {})))).then(() => c.put("/", new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
      })).catch(() => {})); }
      return res;
    });
    e.respondWith(caches.match("/").then((r) => { if (r) { e.waitUntil(net.catch(() => {})); return r; } return net; }).catch(() => net));
  }
});
self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { title: "UVALO Inspecții", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(m.title || "UVALO Inspecții", {
    body: m.body || "", tag: m.tag, renotify: !!m.tag, icon: "/loc-icon-192.png", badge: "/loc-icon-192.png", data: { url: m.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => new URL(c.url).origin === location.origin);
    if (w) return w.focus().then(() => w.navigate(url));
    return self.clients.openWindow(url);
  }));
});`;

export function GET() {
  return new Response(SW, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" } });
}
