/* UVALO pentru Word – Anexă foto → „Din inspecții”: inspecțiile mele cu fotografii sau cu fișa începută pe telefon.
   „Adaugă pozele” = pozele de pe server intră în lista anexei (pe categorii, cu ora de pe telefon și categoria ca descriere),
   apoi se aranjează și se inserează ca de obicei; „Inserează fișa” = fișa de inspecție, ca tabele, la cursor în documentul activ. */
(function () {
  "use strict";

  var list = null, loading = false, working = false;
  var STATUS = { prog: "De programat", plan: "Programată", lucru: "În lucru", gata: "Finalizată", pred: "Predată" };

  function $(id) { return document.getElementById(id); }
  function app() { return window.AnexaApp; }
  function toast(m, k, ms) { app().toast(m, k, ms); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fold(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function day(iso) { if (!iso) return ""; var d = new Date(iso.length === 16 ? iso + ":00" : iso); return isNaN(d) ? "" : d.toLocaleDateString("ro-RO"); }
  function info(t) { $("ipkInfo").textContent = t || ""; }

  async function getJson(url) {
    var r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    var d = await r.json().catch(function () { return {}; });
    if (r.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search); throw new Error("Autentifică-te din nou."); }
    if (!r.ok) throw new Error(d.error || "Nu am putut încărca datele.");
    return d;
  }

  async function open() {
    $("inspDlg").hidden = false;
    $("ipkQ").focus();
    if (list || loading) return render();
    loading = true; info("Se încarcă inspecțiile…"); $("ipkList").innerHTML = "";
    try {
      var d = await getJson("/api/word/inspectii");
      list = d.list || [];
      if (d.off) $("ipkList").innerHTML = '<div class="ipk-empty">Inspecțiile nu sunt încă active în contul tău.</div>';
    } catch (e) { info(""); $("ipkList").innerHTML = '<div class="ipk-empty">' + esc(e.message) + "</div>"; }
    loading = false;
    if (list) render();
  }
  function close() { if (!working) $("inspDlg").hidden = true; }

  function render() {
    if (!list) return;
    var q = fold($("ipkQ").value.trim());
    var rows = list.filter(function (x) { return !q || fold([x.address, x.cad_nr, x.code, x.sheet_no, x.prop_type].join(" ")).indexOf(q) >= 0; });
    info(list.length ? (q ? rows.length + " din " + list.length : list.length + (list.length === 1 ? " inspecție" : " inspecții") + " cu fotografii sau fișă") : "");
    if (!list.length) { $("ipkList").innerHTML = '<div class="ipk-empty">Nu ai încă inspecții cu fotografii sau cu fișa completată.<br/>Ele apar aici după ce le faci pe telefon.</div>'; return; }
    $("ipkList").innerHTML = rows.map(function (x) {
      var meta = [x.prop_type, x.sheet_no ? "Fișa " + x.sheet_no : x.code, day(x.when), x.who].filter(Boolean).join(" · ");
      return '<div class="ipk-it" data-id="' + esc(x.id) + '">' +
        "<b>" + esc(x.address) + '<span class="ipk-st">' + esc(STATUS[x.status] || x.status) + "</span></b>" +
        "<small>" + esc(meta) + (x.cad_nr ? " · nr. cad. " + esc(x.cad_nr) : "") + "</small>" +
        '<span class="ipk-acts">' +
        '<button type="button" class="btn primary" data-a="photos"' + (x.photos ? "" : " disabled") + ">" + (x.photos ? "Adaugă pozele (" + x.photos + ")" : "Fără fotografii") + "</button>" +
        '<button type="button" class="btn" data-a="sheet"' + (x.sheet ? "" : ' disabled title="Fișa se completează pe telefon"') + ">Inserează fișa</button>" +
        "</span></div>";
    }).join("") || '<div class="ipk-empty">Nicio inspecție pentru „' + esc($("ipkQ").value) + "”.</div>";
  }

  /** The photos of the inspection → File objects (named so they keep the order: by category, then by time) → the annex list. */
  async function addPhotos(id) {
    var d = await getJson("/api/word/inspectii/" + encodeURIComponent(id));
    var ph = d.photos || [];
    if (!ph.length) { toast("Inspecția nu are fotografii.", "err"); return; }
    // the sheet's categories first, in their order (Exterior, Interior…), the rooms / other categories after, as they were taken; "Altele" last
    var cats = (d.cats || []).filter(function (c) { return c !== "Altele"; }), order = [];
    ph.forEach(function (p) { var r = p.room || "Altele"; if (order.indexOf(r) < 0) order.push(r); });
    var rank = function (r) { var k = cats.indexOf(r); return r === "Altele" ? 1e6 : k >= 0 ? k : 1000 + order.indexOf(r); };
    order.sort(function (a, b) { return rank(a) - rank(b); });
    ph = ph.map(function (p, i) { return { p: p, r: p.room || "Altele", i: i }; })
      .sort(function (a, b) { return order.indexOf(a.r) - order.indexOf(b.r) || a.i - b.i; });
    var files = new Array(ph.length), done = 0, next = 0, failed = 0;
    async function worker() {
      while (next < ph.length) {
        var k = next++, x = ph[k];
        try {
          var r = await fetch("/api/inspectii/file/" + encodeURIComponent(x.p.id), { credentials: "same-origin" });
          if (!r.ok) throw new Error("HTTP " + r.status);
          var blob = await r.blob(), ext = /png/.test(blob.type) ? "png" : /webp/.test(blob.type) ? "webp" : "jpg";
          var taken = x.p.taken_at ? Date.parse(x.p.taken_at) : NaN;
          var f = new File([blob], String(k + 1).padStart(3, "0") + " " + x.r.replace(/[\\/:*?"<>|]+/g, "-") + " (" + d.code + ")." + ext,
            { type: blob.type || "image/jpeg", lastModified: isNaN(taken) ? Date.now() : taken });
          f._desc = x.r; f._taken = isNaN(taken) ? null : taken;
          files[k] = f;
        } catch (e) { failed++; }
        info("Se descarcă fotografiile " + (++done) + " / " + ph.length + "…");
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    var ok = files.filter(Boolean);
    if (!ok.length) throw new Error("Nu am putut descărca fotografiile.");
    $("inspDlg").hidden = true;
    await app().addFiles(ok, false, d.title);
    app().track("insp_photos", { n: ok.length });
    if (failed) toast(failed + (failed === 1 ? " fotografie nu a putut fi descărcată." : " fotografii nu au putut fi descărcate."), "err", 5000);
  }

  /** The sheet as tables, at the cursor in the active document. */
  async function insertSheet(id) {
    if (!app().inWord) { toast("Panoul rulează în afara Word (mod demo). Deschide-l din Word → tab-ul UVALO → Anexă foto."); return; }
    var d = await getJson("/api/word/inspectii/" + encodeURIComponent(id) + "?sheet=1");
    info("Se inserează fișa în document…");
    await Word.run(async function (ctx) {
      var sel = ctx.document.getSelection();
      sel.insertHtml(d.html, "After");
      await ctx.sync();
    });
    $("inspDlg").hidden = true;
    toast("Fișa de inspecție " + (d.sheet_no || "") + " a fost inserată la cursor.", "ok", 3000);
  }

  function wire() {
    if (!$("btnInsp")) return;
    $("btnInsp").onclick = open;
    $("ipkClose").onclick = close;
    $("ipkQ").oninput = render;
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("inspDlg").hidden) close(); });
    $("ipkList").addEventListener("click", async function (e) {
      var b = e.target.closest && e.target.closest("button[data-a]");
      if (!b || b.disabled || working) return;
      var id = b.closest(".ipk-it").dataset.id, label = b.textContent;
      working = true; b.disabled = true; b.textContent = "Se încarcă…";
      try { if (b.dataset.a === "photos") await addPhotos(id); else await insertSheet(id); }
      catch (err) { toast(err && err.message ? err.message : "Nu a mers. Încearcă din nou.", "err", 5000); }
      working = false; b.disabled = false; b.textContent = label; info("");
      if (!$("inspDlg").hidden) render();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
