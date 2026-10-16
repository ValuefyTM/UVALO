/* UVALO · butonul de feedback (dreapta jos). Pus în AppShell și injectat în paginile instrumentelor
   (localizator, analiza amplasamentului, comparabile). Trimite la /api/feedback cu sesiunea din cookie.
   Atribute pe <script>: data-bottom (px, desktop) și data-bottom-mobile (px, ecrane < 980 px), ca să nu acopere bare fixe. */
(function () {
  if (window.__uvFeedback) return;
  window.__uvFeedback = true;
  var me = document.currentScript;
  var bottom = (me && me.dataset.bottom) || "16";
  var bottomM = (me && me.dataset.bottomMobile) || bottom;

  var css = "" +
    ".uvfb-btn{position:fixed;right:16px;bottom:" + bottom + "px;z-index:2147483000;width:44px;height:44px;border-radius:999px;border:0;background:#141414;color:#E0AD4F;" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.28);transition:transform .15s}" +
    ".uvfb-btn:hover{transform:scale(1.06)}.uvfb-btn:focus-visible{outline:2px solid #F2A93B;outline-offset:3px}" +
    ".uvfb-tip{position:absolute;right:52px;white-space:nowrap;background:#141414;color:#fff;font:700 12px \"Plus Jakarta Sans\",system-ui,sans-serif;padding:6px 10px;border-radius:8px;opacity:0;pointer-events:none;transition:opacity .15s}" +
    ".uvfb-btn:hover .uvfb-tip,.uvfb-btn:focus-visible .uvfb-tip{opacity:1}.uvfb-btn[aria-expanded=true] .uvfb-tip{opacity:0}" +
    ".uvfb-panel{position:fixed;right:16px;bottom:calc(" + bottom + "px + 54px);z-index:2147483001;width:320px;max-width:calc(100vw - 32px);background:#fff;color:#141414;border:1px solid #E2D8C4;" +
    "border-radius:16px;box-shadow:0 20px 50px rgba(20,16,10,.25);font:13px/1.5 \"Plus Jakarta Sans\",system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}" +
    ".uvfb-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px 8px}.uvfb-head b{font-size:14px}" +
    ".uvfb-x{width:32px;height:32px;border:0;background:transparent;border-radius:999px;font-size:18px;color:#6B6B6B;cursor:pointer}.uvfb-x:hover{background:#F3EEE3}" +
    ".uvfb-body{padding:0 14px 14px;display:flex;flex-direction:column;gap:10px}" +
    ".uvfb-kinds{display:flex;gap:6px;flex-wrap:wrap}.uvfb-kinds button{border:1px solid #E2D8C4;background:#fff;border-radius:999px;padding:6px 11px;font:700 12px \"Plus Jakarta Sans\",system-ui,sans-serif;color:#4A4A4A;cursor:pointer}" +
    ".uvfb-kinds button[aria-pressed=true]{background:#141414;border-color:#141414;color:#fff}" +
    ".uvfb-panel textarea{width:100%;box-sizing:border-box;min-height:96px;resize:vertical;border:1px solid #E2D8C4;border-radius:10px;padding:9px 11px;font:13px/1.5 \"Plus Jakarta Sans\",system-ui,sans-serif;color:#141414;background:#FBF8F2}" +
    ".uvfb-panel textarea:focus{outline:none;border-color:#9A5F00;background:#fff}" +
    ".uvfb-chk{display:flex;gap:8px;align-items:center;font-size:12px;color:#4A4A4A;cursor:pointer}.uvfb-chk input{width:16px;height:16px;accent-color:#E0931A}" +
    ".uvfb-send{height:40px;border:0;border-radius:10px;background:#F2A93B;color:#141414;font:700 13px \"Plus Jakarta Sans\",system-ui,sans-serif;cursor:pointer}.uvfb-send:disabled{opacity:.6;cursor:progress}" +
    ".uvfb-err{color:#B3261E;font-size:12px;font-weight:700}.uvfb-ok{padding:6px 14px 18px;font-size:13px;color:#157F55;font-weight:700}" +
    "@media (max-width:979px){.uvfb-btn{bottom:calc(" + bottomM + "px + env(safe-area-inset-bottom,0px))}.uvfb-panel{bottom:calc(" + bottomM + "px + 54px + env(safe-area-inset-bottom,0px))}}" +
    "@media print{.uvfb-btn,.uvfb-panel{display:none!important}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "uvfb-btn";
  btn.setAttribute("aria-label", "Trimite feedback");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/></svg><span class="uvfb-tip">Feedback</span>';
  document.body.appendChild(btn);

  var panel = null, kind = "problema";
  function close() { if (panel) { panel.remove(); panel = null; } btn.setAttribute("aria-expanded", "false"); btn.focus(); }
  function open() {
    if (panel) return close();
    panel = document.createElement("div");
    panel.className = "uvfb-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Trimite feedback");
    panel.innerHTML = '<div class="uvfb-head"><b>Spune-ne ce crezi</b><button type="button" class="uvfb-x" aria-label="Închide">×</button></div>' +
      '<form class="uvfb-body"><div class="uvfb-kinds" role="group" aria-label="Tipul mesajului">' +
      '<button type="button" data-k="problema" aria-pressed="true">Problemă</button><button type="button" data-k="idee" aria-pressed="false">Idee</button><button type="button" data-k="altceva" aria-pressed="false">Altceva</button></div>' +
      '<textarea maxlength="2000" required aria-label="Mesajul tău" placeholder="Ce nu merge sau ce ai vrea să facă UVALO…"></textarea>' +
      '<label class="uvfb-chk"><input type="checkbox" checked> Îmi puteți răspunde pe email</label>' +
      '<span class="uvfb-err" role="alert" hidden></span><button type="submit" class="uvfb-send">Trimite</button></form>';
    document.body.appendChild(panel);
    btn.setAttribute("aria-expanded", "true");
    kind = "problema";
    var ta = panel.querySelector("textarea"), err = panel.querySelector(".uvfb-err"), send = panel.querySelector(".uvfb-send");
    panel.querySelector(".uvfb-x").onclick = close;
    panel.querySelectorAll(".uvfb-kinds button").forEach(function (b) {
      b.onclick = function () {
        kind = b.dataset.k;
        panel.querySelectorAll(".uvfb-kinds button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        ta.placeholder = kind === "idee" ? "Ce ai vrea să adăugăm sau să schimbăm…" : kind === "problema" ? "Ce nu merge sau ce ai vrea să facă UVALO…" : "Scrie-ne…";
      };
    });
    panel.querySelector("form").onsubmit = function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (text.length < 3) { err.hidden = false; err.textContent = "Scrie câteva cuvinte."; ta.focus(); return; }
      send.disabled = true; send.textContent = "Se trimite…"; err.hidden = true;
      fetch("/api/feedback", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: kind, text: text, contact: panel.querySelector(".uvfb-chk input").checked, page: location.pathname + location.search + location.hash }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) throw new Error(x.d.error || "Nu am putut trimite. Încearcă din nou.");
          panel.querySelector("form").remove();
          var ok = document.createElement("div");
          ok.className = "uvfb-ok"; ok.setAttribute("role", "status");
          ok.textContent = "Mulțumim! Am primit mesajul tău.";
          panel.appendChild(ok);
          setTimeout(function () { if (panel) close(); }, 2500);
        })
        .catch(function (e2) { send.disabled = false; send.textContent = "Trimite"; err.hidden = false; err.textContent = e2.message || "Nu am putut trimite. Verifică conexiunea."; });
    };
    setTimeout(function () { ta.focus(); }, 0);
  }
  btn.onclick = open;
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel) close(); });
})();
