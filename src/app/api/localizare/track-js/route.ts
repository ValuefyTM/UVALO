/**
 * Usage tracking in the locator page: wraps the page's global functions (same approach as export.js) and sends
 * small batches to /api/track. What is recorded: locality opened, searches, parcels opened, exports, GPS / compass.
 */
const JS = `(() => {
  "use strict";
  const q = []; let t = 0;
  const flush = () => {
    if (!q.length) return;
    const body = JSON.stringify({ module: "localizare", events: q.splice(0, 50) });
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))))
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  };
  const track = (action, target, meta) => {
    const last = q[q.length - 1];
    if (last && last.action === action && last.target === (target ?? null)) return; // same thing twice in a row
    q.push({ action, target: target == null ? null : String(target).slice(0, 120), meta: meta || null, at: new Date().toISOString() });
    clearTimeout(t); t = setTimeout(flush, 4000);
  };
  window.vfTrack = track;
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  const uat = () => (typeof U !== "undefined" && U ? U.name : null);
  const wrap = (fn, before, after) => {
    const orig = window[fn];
    if (typeof orig !== "function") return;
    window[fn] = function (...a) {
      try { before && before(...a); } catch {}
      const r = orig.apply(this, a);
      if (after) Promise.resolve(r).then(() => { try { after(...a); } catch {} });
      return r;
    };
  };
  let lastUat = null;
  wrap("loadUat", null, () => { const n = uat(); if (n && n !== lastUat) { lastUat = n; track("uat_open", n); } });
  wrap("show", (id, idx, fromMap) => track("parcel", id, { uat: uat(), via: fromMap ? "hartă" : "căutare" }));
  wrap("showBuilding", (b) => track("building", b && b.c, { uat: uat() }));
  wrap("topoSearch", (v) => track("search_topo", v, { uat: uat() }));
  wrap("addrSearch", (v) => track("address", v));
  wrap("gpsStart", () => track("gps_start", null, { uat: uat() }));
  wrap("compassStart", () => track("compass"));
  wrap("dl", (name) => track(/\\.kml$/i.test(name) ? "export_kml" : "export", name, { uat: uat() }));
  wrap("copy", () => track("copy", null, { uat: uat() }));
  // On the document, in the capture phase: before the page's own handlers (export.js stops the multiple search there).
  document.addEventListener("submit", (e) => {
    if (!e.target || e.target.id !== "f") return;
    const v = (document.getElementById("q") || {}).value || "";
    if (typeof searchMode !== "undefined" && searchMode === "adr") return;
    if (v.trim()) track(/[,;\\s]/.test(v.trim()) ? "search_multi" : "search", v.trim(), { uat: uat() });
  }, true);
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".vfx button[data-k]");
    if (b) track(b.dataset.k === "docx" ? "export_word" : "export_" + b.dataset.k, typeof cur !== "undefined" && cur ? (cur.id ?? cur.c) : "multi", { uat: uat() });
  }, true);
})();`;

export function GET() {
  return new Response(JS, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "private, no-cache" } });
}
