// Service worker of the phone app (served at /sw.js on inspectii.uvalo.ro, scope "/"): the app opens without signal
// (the page and its scripts are kept), the data always goes to the network (answers and photos are queued by the page);
// it shows the push notifications (/api/m/push, webpush.ts) and opens the inspection when one is tapped.
const SW = `const C = "uvalo-insp-v2";
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
