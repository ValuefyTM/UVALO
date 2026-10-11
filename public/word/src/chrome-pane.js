/* UVALO pentru Word – „Comparabile din Chrome”: ultima trimitere din extensia UVALO pentru Chrome
   (/api/chrome/batch), cu bife pe comparabile, inserată la cursor: titlul grupului, numele comparabilei și titlul
   anunțului, „Sursă: link · Data capturii”, apoi capturile, câte una pe rând (pagini A4). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var batch = null, inWord = false;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var fmt = function (ts) { if (!ts) return ""; var d = new Date(ts); return d.toLocaleDateString("ro-RO") + " " + d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }); };
  var img = function (it, k) { return "/api/chrome/batch/" + batch.id + "/" + encodeURIComponent(it.id) + "/" + k; };

  function status(html, kind) {
    var s = $("status"); s.hidden = !html; s.innerHTML = html || "";
    s.style.borderColor = kind === "err" ? "#d9534f" : kind === "ok" ? "#2f6b3a" : "#e6dfcf";
  }

  async function load() {
    try {
      var r = await fetch("/api/chrome/batch", { credentials: "same-origin", cache: "no-store" });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      batch = d.batch;
      if (!batch) {
        $("list").innerHTML = '<div class="card" style="display:block"><b>Nimic trimis încă</b><small>În Chrome, în panoul UVALO pentru Chrome, capturează anunțurile (📷), apoi apasă <b>„Trimite în Word”</b>. Revino aici și apasă Reîncarcă.</small></div><button type="button" class="btn ghost" id="reload">Reîncarcă</button><a class="btn ghost" href="/chrome" data-browser="1">Ce este UVALO pentru Chrome?</a>';
        $("reload").onclick = load;
        return;
      }
      var n = 0, h = '<div class="sec">Trimise ' + esc(fmt(batch.created_at)) + " · disponibile 7 zile</div>";
      batch.groups.forEach(function (g, gi) {
        h += '<div class="sec" style="color:#141414">' + esc(g.name) + "</div>";
        g.items.forEach(function (it, ii) {
          n++;
          h += '<label class="card" style="cursor:pointer;align-items:center"><input type="checkbox" data-g="' + gi + '" data-i="' + ii + '" checked>' +
            '<img src="' + img(it, 0) + '" alt="" style="width:42px;height:56px;object-fit:cover;object-position:top;border-radius:4px;border:1px solid #e6dfcf;flex:none">' +
            "<span><b>" + esc(it.label || "Comparabilă") + "</b><small>" + esc((it.title || it.url).slice(0, 90)) + "</small><small>" + it.slices + (it.slices === 1 ? " pagină" : " pagini") + " · " + esc(fmt(it.capturedAt)) + "</small></span></label>";
        });
      });
      h += '<button type="button" class="btn ghost" id="reload">Reîncarcă</button>';
      $("list").innerHTML = h;
      $("reload").onclick = load;
      $("opts").hidden = false;
      $("insert").textContent = "Inserează " + n + (n === 1 ? " comparabilă" : " comparabile");
      $("list").onchange = function () {
        var k = document.querySelectorAll("#list input[type=checkbox]:checked").length;
        $("insert").textContent = "Inserează " + k + (k === 1 ? " comparabilă" : " comparabile");
        $("insert").disabled = !k;
      };
    } catch (e) {
      $("list").innerHTML = '<div class="card" style="display:block"><b>Nu am putut încărca trimiterea</b><small>' + esc(e.message || e) + '</small></div><button type="button" class="btn ghost" id="reload">Reîncearcă</button>';
      $("reload").onclick = load;
    }
  }

  function b64(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("o captură nu s-a putut descărca (" + r.status + ")");
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (res, rej) {
        var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(",")[1]); }; fr.onerror = rej; fr.readAsDataURL(blob);
      });
    });
  }

  async function insert() {
    if (!inWord) { status("Deschide panoul din Word (tab-ul UVALO → Instrumente → Comparabile din Chrome) ca să inserezi.", "err"); return; }
    var picked = [];
    document.querySelectorAll("#list input[type=checkbox]:checked").forEach(function (c) {
      var g = batch.groups[+c.dataset.g]; picked.push({ group: g.name, it: g.items[+c.dataset.i] });
    });
    if (!picked.length) return;
    var W = Math.max(8, Math.min(19, parseFloat($("optW").value) || 16)) * 28.3465, withGroup = $("optGroup").checked, brk = $("optBreak").checked;
    var link13 = Office.context.requirements.isSetSupported("WordApi", "1.3");
    $("insert").disabled = true;
    try {
      var lastGroup = null;
      for (var p = 0; p < picked.length; p++) {
        var it = picked[p].it;
        status("Se inserează " + (p + 1) + " / " + picked.length + ": " + esc(it.label || it.title) + "…");
        var imgs = [];
        for (var k = 0; k < it.slices; k++) imgs.push(await b64(img(it, k)));
        var newGroup = withGroup && picked[p].group !== lastGroup;
        lastGroup = picked[p].group;
        await Word.run(async function (ctx) {
          var sel = ctx.document.getSelection();
          var first = null, cur = null;
          var add = function (text) {
            var para = cur ? cur.insertParagraph(text, "After") : sel.insertParagraph(text, "After");
            if (!first) first = para;
            cur = para; return para;
          };
          if (newGroup) {
            var gp = add(picked[p].group.toUpperCase());
            gp.font.bold = true; gp.font.size = 12; gp.font.color = "#141414"; gp.alignment = "Left";
          }
          var t = add(it.label || "");
          t.font.size = 11; t.font.bold = true; t.font.color = "#141414"; t.alignment = "Left";
          if (it.title) { var tr = t.insertText((it.label ? " — " : "") + it.title.slice(0, 160), "End"); tr.font.bold = false; tr.font.size = 9; tr.font.color = "#444444"; }
          var s = add("Sursă: ");
          s.font.size = 8; s.font.bold = false; s.font.color = "#555555"; s.alignment = "Left";
          var lr = s.insertText(it.url, "End"); lr.font.color = "#1155CC"; lr.font.underline = "Single";
          if (link13) lr.hyperlink = it.url;
          var dr = s.insertText("   •   Data capturii: " + fmt(it.capturedAt), "End"); dr.font.color = "#555555"; dr.font.underline = "None";
          imgs.forEach(function (data) {
            var ip = add("");
            ip.alignment = "Centered";
            var pic = ip.insertInlinePictureFromBase64(data, "Start");
            pic.lockAspectRatio = true; pic.width = W;
          });
          if (brk && p > 0) first.insertBreak("Page", "Before");
          cur.getRange("End").select();
          await ctx.sync();
        });
      }
      status("Gata: " + picked.length + (picked.length === 1 ? " comparabilă inserată" : " comparabile inserate") + " în raport.", "ok");
      try {
        fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
          body: JSON.stringify({ module: "word", events: [{ action: "insert_chrome", meta: { n: picked.length } }] }) }).catch(function () { });
      } catch (e) { }
    } catch (e) {
      status("Nu am putut insera: " + esc(e && e.message ? e.message : e), "err");
    } finally { $("insert").disabled = false; }
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-browser]"); if (!a) return;
    e.preventDefault(); var u = new URL(a.getAttribute("href"), location.href).href;
    try { if (window.Office && Office.context && Office.context.ui && Office.context.ui.openBrowserWindow) { Office.context.ui.openBrowserWindow(u); return; } } catch (x) { }
    window.open(u, "_blank");
  });
  document.addEventListener("DOMContentLoaded", function () {
    $("insert").onclick = insert;
    load();
    var ready = function (info) { inWord = !!(window.Office && info && info.host === Office.HostType.Word); };
    if (window.Office && Office.onReady) Office.onReady(ready); else ready(null);
  });
})();
