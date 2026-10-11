/* UVALO pentru Word – în fereastra mare a localizatorului de comparabile (/comparabile?word=1):
   butonul „Inserează în raport” trimite harta (PNG) și tabelul către panoul din Word, pe bucăți. */
(function () {
  "use strict";
  var CHUNK = 30000;
  function send(obj) { Office.context.ui.messageParent(JSON.stringify(obj)); }

  async function insert(btn) {
    if (!state.ready) { toast("Harta nu este încărcată încă. Așteaptă câteva secunde."); return; }
    if (!state.subject && !state.comps.length) { toast("Adaugă cel puțin un punct pe hartă."); return; }
    btn.disabled = true; var lbl = btn.textContent; btn.textContent = "Se trimite în Word…";
    try {
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { }
      var cv = await renderMapCanvas(1200, 760);
      var png;
      try { png = cv.toDataURL("image/png"); } catch (e) { toast(CORS_MSG, 7000); return; }
      var rows = [["Nr.", "Adresă / locație", "Distanță", "Preț (€)", "Suprafață (mp)", "€/mp", "Camere", "Tip"]];
      if (state.subject) rows.push(["S", state.subject.label || "", "—", "", "", "", "", "subiect"]);
      state.comps.forEach(function (c, i) {
        var ppm = (c.price && c.area && +c.area > 0) ? fmtNum(Math.round(+c.price / +c.area)) : "";
        rows.push([String(i + 1), c.label || "", fmtDist(c.dist), c.price ? fmtNum(+c.price) : "", c.area ? fmtNum(+c.area) : "", ppm, String(c.rooms || ""), c.ptype || ""]);
      });
      var full = JSON.stringify({ png: png, rows: rows });
      var id = Date.now().toString(36), n = Math.ceil(full.length / CHUNK);
      send({ t: "b", id: id, n: n });
      for (var i = 0; i < n; i++) send({ t: "p", id: id, i: i, d: full.slice(i * CHUNK, (i + 1) * CHUNK) });
      send({ t: "e", id: id });
      toast("Trimis în Word. Harta și tabelul apar în document, la cursor.", 5000);
    } catch (e) {
      toast("Nu am putut trimite harta în Word: " + (e && e.message ? e.message : e), 7000);
    } finally { btn.disabled = false; btn.textContent = lbl; }
  }

  function mount() {
    var foot = document.querySelector(".panel-footer");
    if (!foot || document.getElementById("wordInsert")) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "wordInsert"; b.className = "btn primary"; b.textContent = "Inserează în raport";
    b.style.background = "#E0AD4F"; b.style.borderColor = "#E0AD4F"; b.style.color = "#141414"; b.style.fontWeight = "700";
    b.onclick = function () { insert(b); };
    foot.insertBefore(b, foot.firstChild);
    var back = document.querySelector(".pback"); if (back) back.style.display = "none"; // în fereastra din Word nu are unde să se întoarcă
    try {
      Office.context.ui.addHandlerAsync && Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, function (a) {
        if (a.message === "ok") toast("Inserat în raport ✓", 4000);
        else if (a.message === "err") toast("Word nu a putut insera harta. Vezi mesajul din panoul UVALO.", 6000);
      });
    } catch (e) { }
  }

  if (window.Office && Office.onReady) Office.onReady(function () { if (Office.context && Office.context.ui && Office.context.ui.messageParent) mount(); });
})();
