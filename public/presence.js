/* UVALO · prezența (cine e online): un semnal pe minut cât pagina e vizibilă → /api/ping, pentru Admin → Panou. */
(function () {
  if (window.__uvPresence) return;
  window.__uvPresence = true;
  var last = 0;
  function ping() {
    if (document.visibilityState !== "visible" || Date.now() - last < 50000) return;
    last = Date.now();
    try {
      fetch("/api/ping", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: location.pathname + location.hash }) }).catch(function () {});
    } catch (e) {}
  }
  ping();
  setInterval(ping, 60000);
  document.addEventListener("visibilitychange", ping);
})();
