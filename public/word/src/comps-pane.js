/* UVALO pentru Word – panoul „Comparabile”: deschide localizatorul de comparabile într-o fereastră mare
   și inserează în document ce trimite fereastra (harta ca imagine + tabelul comparabilelor). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var dialog = null, parts = {}, inWord = false;

  function status(html, kind) {
    var s = $("status"); s.hidden = !html; s.innerHTML = html || "";
    s.style.borderColor = kind === "err" ? "#d9534f" : kind === "ok" ? "#2f6b3a" : "#e6dfcf";
  }

  function open() {
    var url = new URL("/comparabile?word=1", location.href).href;
    if (!inWord) { window.open(url, "_blank"); return; }
    if (dialog) { try { dialog.close(); } catch (e) { } dialog = null; }
    Office.context.ui.displayDialogAsync(url, { height: 92, width: 92, displayInIframe: false }, function (r) {
      if (r.status !== Office.AsyncResultStatus.Succeeded) {
        status("Fereastra nu s-a putut deschide (" + (r.error && r.error.message || "eroare") + "). Încearcă din nou.", "err");
        return;
      }
      dialog = r.value;
      status("Fereastra hărții este deschisă. Când ești gata, apasă acolo <b>Inserează în raport</b>.");
      dialog.addEventHandler(Office.EventType.DialogMessageReceived, onMessage);
      dialog.addEventHandler(Office.EventType.DialogEventReceived, function () {
        dialog = null; status("Fereastra hărții s-a închis. O poți redeschide oricând.");
      });
    });
  }

  // mesajele vin pe bucăți (o imagine are câțiva MB): {t:"b",id,n} … {t:"p",id,i,d} … {t:"e",id}
  function onMessage(arg) {
    var m; try { m = JSON.parse(arg.message); } catch (e) { return; }
    if (m.t === "b") parts[m.id] = { n: m.n, got: [] };
    else if (m.t === "p" && parts[m.id]) parts[m.id].got[m.i] = m.d;
    else if (m.t === "e" && parts[m.id]) {
      var p = parts[m.id]; delete parts[m.id];
      var full = p.got.join("");
      var data; try { data = JSON.parse(full); } catch (e) { status("Datele hărții au ajuns incomplete. Încearcă din nou.", "err"); reply("err"); return; }
      insert(data);
    }
  }
  function reply(what) { try { dialog && dialog.messageChild && dialog.messageChild(what); } catch (e) { } }

  async function insert(d) {
    status("Se inserează harta în document…");
    try {
      var b64 = String(d.png || "").replace(/^data:image\/\w+;base64,/, "");
      var withTable = $("optTable").checked && d.rows && d.rows.length > 1 && Office.context.requirements.isSetSupported("WordApi", "1.3");
      await Word.run(async function (ctx) {
        var sel = ctx.document.getSelection();
        var anchor = sel.insertParagraph($("optTitle").checked ? (d.title || "Localizarea proprietății subiect și a comparabilelor") : "", "Before");
        if ($("optTitle").checked) { anchor.font.bold = true; anchor.font.size = 12; }
        var pPic = anchor.insertParagraph("", "After");
        pPic.alignment = "Centered";
        var pic = pPic.insertInlinePictureFromBase64(b64, "Start");
        pic.lockAspectRatio = true; pic.width = window.UVALO_CAP ? UVALO_CAP.widthPt() : 450;
        var cap = pPic.insertParagraph(d.caption || "Amplasarea proprietății subiect și a comparabilelor (distanțe în linie dreaptă)", "After");
        cap.alignment = "Centered"; cap.font.italic = true; cap.font.size = 9; cap.font.bold = false;
        if (withTable) {
          var t = cap.insertTable(d.rows.length, d.rows[0].length, "After", d.rows);
          t.headerRowCount = 1; t.font.size = 9; t.font.bold = false;
          t.rows.getFirst().font.bold = true;
        }
        if (!$("optTitle").checked) anchor.delete();
        await ctx.sync();
      });
      status("Gata: harta" + (withTable ? " și tabelul au" : " a") + " fost inserate în document.", "ok");
      reply("ok");
      track(d.rows ? d.rows.length - 1 : 0);
    } catch (e) {
      status("Nu am putut insera: " + (e && e.message ? e.message : e), "err");
      reply("err");
    }
  }

  function track(n) {
    try {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ module: "word", events: [{ action: "insert_comps", meta: { n: n } }] }) }).catch(function () { });
    } catch (e) { }
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("open").onclick = open;
    var ready = function (info) {
      inWord = !!(window.Office && info && info.host === Office.HostType.Word);
      if (inWord) open(); else status("Deschide panoul din Word (tab-ul UVALO → Comparabile) ca să inserezi în raport.");
    };
    if (window.Office && Office.onReady) Office.onReady(ready); else ready(null);
  });
})();
