/* UVALO pentru Word – Anexă foto și Anexă documente: logica panoului lateral.
   Etichetele blocurilor din document (valuefy-anexa-*) rămân ca la add-in-ul VALUEFY, ca să fie recunoscute anexele vechi. */
(function () {
  "use strict";

  var CHUNK_BYTES = 2.5 * 1024 * 1024; // mărimea maximă a unui pachet trimis către Word
  var IMG_RE = /\.(jpe?g|png|webp|bmp|gif)$/i;
  var PDF_RE = /\.pdf$/i;
  var L = window.AnexaLayout;

  var DEFAULTS = {
    perPage: 6, fit: "contain", ratio: "4:3", ratioFollowOrientation: false,
    gapMm: 4, border: "none", borderColor: "7F7F7F",
    caption: { enabled: true, prefix: "Foto", numbering: true, startAt: 1, fontSize: 9, spaceBeforePt: 2,
      lines: 1, boldPrefix: true, separator: " – ", useFileName: false },
    title: { enabled: true, text: "ANEXA – FOTOGRAFII", fontSize: 12, spaceAfterPt: 8, align: "center",
      style: "bold", repeat: false, repeatSuffix: " (continuare)" },
    page: { wCm: 17, hCm: 25.7 },
    dpi: 150, jpegQ: 0.85, fontName: "Arial", startNewPage: false,
    docTitle: { enabled: false, prefix: "", style: "bold", fontSize: 11, align: "left", spaceAfterPt: 6, repeat: false }
  };

  // Modul „documente PDF”: o pagină PDF pe o pagină Word, cu chenar subțire.
  var PDF_DEFAULTS = merge(DEFAULTS, {
    perPage: 1, border: "thin", dpi: 220, jpegQ: 0.9, startNewPage: true, autoRotate: true,
    caption: { enabled: false, prefix: "Pagina", useFileName: true },
    title: { text: "ANEXA – DOCUMENTE", repeat: false },
    docTitle: { enabled: true }
  });

  var MODES = {
    photo: { tag: "valuefy-anexa-foto", key: "valuefy-anexa-foto-settings-v1", defaults: DEFAULTS,
      unit: ["poză", "poze"], one: ["imagine", "imagini"], title: "Anexă foto" },
    pdf: { tag: "valuefy-anexa-pdf", key: "valuefy-anexa-pdf-settings-v1", defaults: PDF_DEFAULTS,
      unit: ["pagină", "pagini"], one: ["pagină", "pagini"], title: "Anexă documente" }
  };
  // fiecare buton din ribbon deschide panoul cu ?mode=photo sau ?mode=pdf
  var mode = /[?&]mode=pdf\b/.test(location.search) ? "pdf" : "photo";
  function M() { return MODES[mode]; }
  var bags = { photo: { items: [], sortMode: "manual" }, pdf: { items: [], sortMode: "manual" } };

  var S = loadSettings();
  var items = [];        // {id, kind, file, doc, page, name, path, size, modified, taken, w, h, thumb0, thumb, rot, sel, desc}
  var sortMode = "manual";
  var docUid = 0;
  var inWord = false, busy = false, hasExisting = false;
  var uid = 0, lbIndex = -1;

  // ---------- utilitare ----------
  function $(id) { return document.getElementById(id); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, over) {
    var out = clone(base);
    Object.keys(over || {}).forEach(function (k) {
      if (out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) out[k] = Object.assign(out[k], over[k]);
      else out[k] = over[k];
    });
    return out;
  }
  function loadSettings() {
    try { var raw = localStorage.getItem(M().key); if (raw) return merge(M().defaults, JSON.parse(raw)); } catch (e) { }
    return clone(M().defaults);
  }
  function saveSettings() { try { localStorage.setItem(M().key, JSON.stringify(S)); } catch (e) { } }
  function fmtMB(b) { return b < 1024 * 1024 ? Math.round(b / 1024) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB"; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  var toastT;
  function toast(msg, kind, ms) {
    var t = $("toast");
    t.textContent = msg; t.className = "toast" + (kind ? " " + kind : ""); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }

  function selected() { return items.filter(function (i) { return i.sel; }); }

  function niceName(name) {
    var base = name.replace(/\.[^.]+$/, "");
    if (/^(img|dsc|dscn|pxl|p|dji|wp|photo|image|screenshot)?[_\-\s]?\d{3,}/i.test(base)) return "";
    if (/^\d[\d_\-\s.]*$/.test(base)) return "";
    base = base.replace(/^\d+[\s._\-]+/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
  }
  function descFor(it) {
    if (it.desc && it.desc.trim()) return it.desc.trim();
    return S.caption.useFileName ? niceName(it.name) : "";
  }

  // ---------- încărcare imagini ----------
  function loadImg(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Nu pot citi imaginea")); };
      img.src = url;
    });
  }

  function makeThumb(img, max) {
    var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    var g = c.getContext("2d"); g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  }

  function rotateDataUrl(src, rot) {
    if (!rot) return Promise.resolve(src);
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas"), sw = rot % 180 !== 0;
        c.width = sw ? im.height : im.width; c.height = sw ? im.width : im.height;
        var g = c.getContext("2d");
        g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180);
        g.drawImage(im, -im.width / 2, -im.height / 2);
        res(c.toDataURL("image/jpeg", 0.85));
      };
      im.src = src;
    });
  }

  /** Mod PDF: paginile landscape se rotesc automat ca să umple pagina portret (reversibil). */
  async function applyAutoRotate(list) {
    if (mode !== "pdf") return;
    var want = !!S.autoRotate && S.page.hCm > S.page.wCm;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it.thumb0 || it.bad) continue;
      if (want && it.w > it.h && it.rot === 0 && !it.userRot) { it.rot = 90; it.autoRot = true; }
      else if (!want && it.autoRot) { it.rot = 0; it.autoRot = false; }
      else continue;
      it.thumb = await rotateDataUrl(it.thumb0, it.rot);
    }
  }

  function docTitleFrom(name) {
    var b = String(name || "").replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").trim();
    return b ? b.charAt(0).toUpperCase() + b.slice(1) : "";
  }
  /** Numărul fiecărui document (doar cele cu pagini bifate), în ordinea din listă. */
  function docNumbers() {
    var m = {}, n = 0;
    items.forEach(function (it) { if (it.sel && it.doc && !m[it.doc.id]) m[it.doc.id] = ++n; });
    return m;
  }
  function docTitleText(doc, n) {
    var pre = String(S.docTitle.prefix || "").replace(/\{n\}/g, n);
    return (pre + (doc.title || "")).trim();
  }
  /** Împarte elementele bifate pe pagini Word. În modul documente, fiecare document începe pe pagină nouă cu titlul lui. */
  function paginate(sel) {
    var per = L.computeLayout(S).perPage, out = [];
    var useDT = mode === "pdf" && S.docTitle && S.docTitle.enabled;
    if (!useDT) {
      for (var i = 0; i < sel.length; i += per) out.push({ items: sel.slice(i, i + per), docTitle: null });
      return out;
    }
    var dn = docNumbers(), groups = [];
    sel.forEach(function (it) {
      var g = groups[groups.length - 1];
      if (!g || g.doc !== it.doc) { g = { doc: it.doc, items: [] }; groups.push(g); }
      g.items.push(it);
    });
    groups.forEach(function (g) {
      var t = g.doc ? docTitleText(g.doc, dn[g.doc.id]) : "";
      for (var j = 0; j < g.items.length; j += per) {
        var dt = j === 0 ? t : (S.docTitle.repeat && t ? t + " (continuare)" : null);
        out.push({ items: g.items.slice(j, j + per), docTitle: dt || null });
      }
    });
    return out;
  }
  function layFor(pg) { return pg.docTitle ? L.computeLayout(S, { docTitle: true }) : L.computeLayout(S); }

  function dims(it) { return it.rot % 180 ? { w: it.h, h: it.w } : { w: it.w, h: it.h }; }

  // ---------- PDF (pdf.js local) ----------
  function pdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("Biblioteca PDF nu s-a încărcat")); }, 15000);
      window.addEventListener("pdfjs-ready", function () { clearTimeout(t); res(window.pdfjsLib); }, { once: true });
    });
  }
  async function openPdf(file) {
    var lib = await pdfLib(), base = new URL("lib/pdfjs/", location.href).href;
    var data = new Uint8Array(await file.arrayBuffer());
    return lib.getDocument({
      data: data, cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/",
      wasmUrl: base + "wasm/", iccUrl: base + "iccs/", isEvalSupported: false
    }).promise;
  }
  /** Randează o pagină PDF pe canvas: fie la o latură maximă (px), fie la o scară dată (1 = 72 dpi). */
  async function renderPdfPage(it, maxPx, scale) {
    var page = await it.doc.pdf.getPage(it.page);
    var v1 = page.getViewport({ scale: 1 });
    var sc = scale || (maxPx / Math.max(v1.width, v1.height));
    sc = Math.max(0.05, Math.min(sc, 6));
    var vp = page.getViewport({ scale: sc });
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(vp.width)); c.height = Math.max(1, Math.ceil(vp.height));
    var g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, canvas: c, viewport: vp }).promise;
    page.cleanup();
    return c;
  }

  function newItem(f, extra) {
    return Object.assign({ id: ++uid, kind: "img", file: f, doc: null, page: 1, name: f.name, path: f.webkitRelativePath || f.name,
      size: f.size, modified: f.lastModified, taken: null, w: 0, h: 0, thumb0: "", thumb: "", rot: 0, sel: true, desc: "", bad: false }, extra || {});
  }

  async function addFiles(fileList, replace, label) {
    var files = Array.prototype.slice.call(fileList || []);
    var pdfMode = mode === "pdf";
    var accept = function (f) { return IMG_RE.test(f.name) || (pdfMode && PDF_RE.test(f.name)); };
    var picked = files.filter(accept);
    var heic = files.filter(function (f) { return /\.(heic|heif)$/i.test(f.name); }).length;
    var pdfsInPhoto = !pdfMode ? files.filter(function (f) { return PDF_RE.test(f.name); }).length : 0;
    if (replace) items = [];
    var known = {};
    items.forEach(function (i) { known[(i.doc ? i.doc.name : i.path) + "|" + i.size] = 1; });
    picked = picked.filter(function (f) { var k = (f.webkitRelativePath || f.name) + "|" + f.size; if (known[k]) return false; known[k] = 1; return true; });
    picked.sort(function (a, b) { return (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "ro", { numeric: true }); });

    if (!picked.length) {
      toast(pdfsInPhoto ? "Aici merg doar imagini. Pentru PDF-uri folosește butonul „Anexă documente” din Word." :
        heic ? "Am găsit doar fișiere HEIC — exportă-le ca JPG." :
        (pdfMode ? "Nu am găsit PDF-uri sau imagini în selecție." : "Nu am găsit imagini în selecție."), "err", 5000);
      render(); return;
    }

    // 1) deschide PDF-urile și creează câte un element pe pagină
    var fresh = [], badDocs = [];
    for (var i = 0; i < picked.length; i++) {
      var f = picked[i];
      if (!PDF_RE.test(f.name)) {
        fresh.push(newItem(f, pdfMode ? { doc: { id: ++docUid, name: f.name, title: docTitleFrom(f.name), pages: 1, pdf: null, size: f.size } } : null));
        continue;
      }
      $("srcInfo").textContent = "Deschid " + f.name + "…";
      try {
        var pdf = await openPdf(f);
        var doc = { id: ++docUid, name: f.name, title: docTitleFrom(f.name), pdf: pdf, pages: pdf.numPages, size: f.size };
        for (var p = 1; p <= pdf.numPages; p++) {
          var pg = await pdf.getPage(p), vp = pg.getViewport({ scale: 1 });
          fresh.push(newItem(f, { kind: "pdf", doc: doc, page: p, path: f.name + "#" + String(p).padStart(4, "0"), w: vp.width, h: vp.height }));
        }
      } catch (e) {
        console.error(e);
        badDocs.push(f.name + (e && e.name === "PasswordException" ? " (parolă)" : ""));
      }
    }
    items = items.concat(fresh);
    render();

    // 2) miniaturi: imaginile în paralel, paginile PDF pe rând
    var done = 0, total = fresh.length;
    var tick = function (it) {
      done++; updateCard(it);
      if (done % 4 === 0 || done === total) $("srcInfo").textContent = done < total ? "Se încarcă " + done + " / " + total + "…" : "";
    };
    var imgQ = fresh.filter(function (x) { return x.kind === "img"; }), pdfQ = fresh.filter(function (x) { return x.kind === "pdf"; });
    var qi = 0;
    async function imgWorker() {
      while (qi < imgQ.length) {
        var it = imgQ[qi++];
        try {
          var r = await loadImg(it.file);
          it.w = r.img.naturalWidth; it.h = r.img.naturalHeight;
          it.thumb0 = it.thumb = makeThumb(r.img, 360);
          URL.revokeObjectURL(r.url);
          it.taken = await window.readExifDate(it.file);
        } catch (e) { it.bad = true; it.sel = false; }
        tick(it);
      }
    }
    async function pdfWorker() {
      for (var j = 0; j < pdfQ.length; j++) {
        var it = pdfQ[j];
        try { var c = await renderPdfPage(it, 360); it.thumb0 = it.thumb = c.toDataURL("image/jpeg", 0.82); c.width = c.height = 0; }
        catch (e) { it.bad = true; it.sel = false; }
        tick(it);
      }
    }
    await Promise.all([imgWorker(), imgWorker(), imgWorker(), pdfWorker()]);
    await applyAutoRotate(fresh);
    var bad = fresh.filter(function (i) { return i.bad; }).length;
    if (sortMode !== "manual") applySort();
    if (label) S._lastFolder = label;
    render();
    var u = M().one;
    var msg = plural(fresh.length - bad, u[0] + " încărcată", u[1] + " încărcate");
    var nd = pdfQ.length ? Object.keys(pdfQ.reduce(function (m, x) { m[x.doc.id] = 1; return m; }, {})).length : 0;
    if (nd) msg += " din " + plural(nd, "PDF", "PDF-uri");
    if (bad) msg += " · " + bad + " nu au putut fi citite";
    if (badDocs.length) msg += " · nu am putut deschide: " + badDocs.join(", ");
    if (heic) msg += " · " + heic + " HEIC ignorate";
    toast(msg, bad || heic || badDocs.length ? "" : "ok", badDocs.length ? 7000 : 2500);
  }

  // drag & drop de fișiere/foldere din Explorer
  function readEntries(entry) {
    return new Promise(function (res) {
      if (entry.isFile) { entry.file(function (f) { res([f]); }, function () { res([]); }); return; }
      if (!entry.isDirectory) { res([]); return; }
      var reader = entry.createReader(), all = [];
      (function next() {
        reader.readEntries(function (ents) {
          if (!ents.length) {
            Promise.all(all.map(readEntries)).then(function (lists) { res([].concat.apply([], lists)); });
            return;
          }
          all = all.concat(ents); next();
        }, function () { res([]); });
      })();
    });
  }

  // ---------- sortare ----------
  function applySort() {
    var cmpName = function (a, b) { return a.path.localeCompare(b.path, "ro", { numeric: true }); };
    var t = function (i) { return i.taken || i.modified || 0; };
    var f = {
      "name": cmpName,
      "name-desc": function (a, b) { return -cmpName(a, b); },
      "taken": function (a, b) { return t(a) - t(b) || cmpName(a, b); },
      "taken-desc": function (a, b) { return t(b) - t(a) || cmpName(a, b); },
      "modified": function (a, b) { return a.modified - b.modified || cmpName(a, b); },
      "selected-first": function (a, b) { return (b.sel - a.sel); }
    }[sortMode];
    if (f) {
      // sortare stabilă
      items = items.map(function (x, i) { return [x, i]; })
        .sort(function (a, b) { return f(a[0], b[0]) || a[1] - b[1]; })
        .map(function (x) { return x[0]; });
    }
  }

  // ---------- randare listă ----------
  var grid;
  function numberMap() {
    var m = {}, n = S.caption.startAt || 1;
    items.forEach(function (i) { if (i.sel) m[i.id] = n++; });
    return m;
  }

  function cardHtml(it, num) {
    var d = document.createElement("div");
    d.className = "card-ph" + (it.sel ? " sel" : " off");
    d.draggable = true; d.dataset.id = it.id;
    d.innerHTML =
      '<div class="th" title="' + it.path.replace(/"/g, "&quot;") + '">' +
      (it.thumb ? '<img alt="" src="' + it.thumb + '"/>' : '<span class="muted small">' + (it.bad ? "eroare" : "…") + "</span>") +
      '<span class="num">' + (num || "–") + "</span>" +
      '<span class="tick">' + (it.sel ? "✓" : "") + "</span>" +
      '<div class="acts"><button data-a="zoom" title="Mărește">⤢</button><button data-a="rot" title="Rotește 90°">↻</button><button data-a="del" title="Scoate din listă">✕</button></div>' +
      "</div>" +
      '<div class="meta"><div class="fname">' + escapeHtml(mode === "pdf" ? (it.kind === "pdf" ? "pag. " + it.page : "imagine") : label(it)) + "</div>" +
      '<input type="text" placeholder="Descriere…" value="' + escapeHtml(it.desc) + '"/></div>';
    return d;
  }
  function label(it) { return it.kind === "pdf" ? it.name.replace(/\.pdf$/i, "") + " · p. " + it.page + "/" + it.doc.pages : it.name; }
  function escapeHtml(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function updateCard(it) {
    var el = grid.querySelector('[data-id="' + it.id + '"]');
    if (!el) return;
    var nm = numberMap();
    el.replaceWith(cardHtml(it, nm[it.id]));
  }

  /** Actualizează bifele și numerele fără a reconstrui grila (păstrează focusul, dublu-click etc.). */
  function refreshMarks() {
    if (mode === "pdf") { render(); return; }
    var nm = numberMap();
    grid.querySelectorAll(".card-ph").forEach(function (el) {
      var it = byId(el.dataset.id); if (!it) return;
      el.classList.toggle("sel", it.sel); el.classList.toggle("off", !it.sel);
      el.querySelector(".num").textContent = nm[it.id] || "–";
      el.querySelector(".tick").textContent = it.sel ? "✓" : "";
    });
    var n = items.length, ns = selected().length;
    $("tabCount").textContent = n ? ns + "/" + n : "0";
    renderDocs();
    $("srcInfo").textContent = (S._lastFolder ? "📁 " + S._lastFolder + " · " : "") + plural(n, M().one[0], M().one[1]) + " · " + ns + " bifate";
    renderFooter();
  }

  function docCard(g, idx, total, dnum, nm, only) {
    var ns = g.items.filter(function (x) { return x.sel; }).length, all = ns === g.items.length;
    var d = document.createElement("div");
    d.className = "dcard" + (ns ? "" : " off"); d.dataset.k = g.key;
    var doc = g.items[0].doc || {};
    d.innerHTML =
      '<div class="dhead">' +
      '<input type="checkbox" data-d="tog"' + (all ? " checked" : "") + ' title="Bifează / debifează toate paginile"/>' +
      '<span class="dnum">' + (ns ? dnum : "–") + "</span>" +
      '<input type="text" class="dtitle" data-d="title" placeholder="Titlul documentului" value="' + escapeHtml(doc.title || "") + '"/>' +
      '<button data-d="up" title="Mută documentul mai sus"' + (idx === 0 ? " disabled" : "") + ">▲</button>" +
      '<button data-d="down" title="Mută documentul mai jos"' + (idx === total - 1 ? " disabled" : "") + ">▼</button>" +
      '<button data-d="del" title="Scoate documentul">✕</button></div>' +
      '<div class="dmeta">' + escapeHtml(g.name) + " · " + plural(g.items.length, "pagină", "pagini") + (all ? "" : " · " + ns + " bifate") + "</div>";
    var strip = document.createElement("div"); strip.className = "strip";
    g.items.forEach(function (it) { if (!only || it.sel) strip.appendChild(cardHtml(it, nm[it.id])); });
    d.appendChild(strip);
    if (ns && !all) d.querySelector('[data-d="tog"]').indeterminate = true;
    return d;
  }


  /* ---- sesiunea: pozele / actele rămân când panoul se închide și se redeschide (IndexedDB, 12 ore) ---- */
  var SESSION_TTL = 12 * 3600e3, saveT = null, restoring = false, dbp = null, savedFiles = {};
  function idb() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open("uvalo-anexe", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("sessions"); r.result.createObjectStore("files"); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function scheduleSave() { if (restoring) return; clearTimeout(saveT); saveT = setTimeout(saveSession, 700); }
  async function saveSession() {
    if (restoring) return;
    try {
      var db = await idb(), files = {}, docs = {};
      var meta = items.map(function (it) {
        if (!it.fk) it.fk = mode + ":" + (it.file.webkitRelativePath || it.file.name) + "|" + it.file.size + "|" + it.file.lastModified;
        files[it.fk] = it.file;
        var o = {};
        for (var k in it) if (k !== "file" && k !== "doc") o[k] = it[k];
        if (it.doc) {
          o.docId = it.doc.id;
          var d = {}; for (var j in it.doc) if (j !== "pdf") d[j] = it.doc[j];
          docs[it.doc.id] = d;
        }
        return o;
      });
      var t = db.transaction(["sessions", "files"], "readwrite"), fs = t.objectStore("files");
      Object.keys(files).forEach(function (k) { if (!savedFiles[k]) { fs.put(files[k], k); savedFiles[k] = 1; } });
      Object.keys(savedFiles).forEach(function (k) { if (k.indexOf(mode + ":") === 0 && !files[k]) { fs.delete(k); delete savedFiles[k]; } });
      t.objectStore("sessions").put({ at: Date.now(), sortMode: sortMode, items: meta, docs: docs, uid: uid, docUid: docUid }, mode);
      await new Promise(function (res, rej) { t.oncomplete = res; t.onerror = t.onabort = function () { rej(t.error); }; });
    } catch (e) { console.warn("Sesiunea anexei nu a putut fi salvată", e); }
  }
  async function restoreSession() {
    if (items.length) return;
    restoring = true; clearTimeout(saveT); // nicio salvare (a listei goale) cât se reface sesiunea
    try {
      var db = await idb();
      var s = await reqP(db.transaction("sessions").objectStore("sessions").get(mode));
      if (!s || !s.items || !s.items.length) return;
      if (Date.now() - s.at > SESSION_TTL) { restoring = false; items = []; await saveSession(); return; }
      var fs = db.transaction("files").objectStore("files"), files = {};
      var keys = s.items.map(function (o) { return o.fk; }).filter(function (k, i, a) { return k && a.indexOf(k) === i; });
      await Promise.all(keys.map(function (k) { return reqP(fs.get(k)).then(function (f) { if (f) { files[k] = f; savedFiles[k] = 1; } }); }));
      var docs = {};
      Object.keys(s.docs || {}).forEach(function (id) { docs[id] = Object.assign({}, s.docs[id], { pdf: null }); });
      var out = [];
      s.items.forEach(function (o) {
        if (!files[o.fk]) return;
        var it = Object.assign({}, o, { file: files[o.fk], doc: o.docId != null ? docs[o.docId] || null : null });
        delete it.docId; out.push(it);
      });
      // PDF-urile se redeschid din fișierul păstrat
      for (var id in docs) {
        var first = out.filter(function (it) { return it.doc === docs[id] && it.kind === "pdf"; })[0];
        if (!first) continue;
        try { docs[id].pdf = await openPdf(first.file); }
        catch (e) { out = out.filter(function (it) { return it.doc !== docs[id]; }); }
      }
      if (items.length || !out.length) return; // între timp s-au adăugat fișiere noi
      items = out;
      uid = Math.max(uid, s.uid || 0); docUid = Math.max(docUid, s.docUid || 0);
      sortMode = s.sortMode || "manual"; try { $("sortSel").value = sortMode; } catch (e) { }
      render();
      toast("Am păstrat lucrul de dinainte: " + plural(items.length, M().unit[0], M().unit[1]) + ". „Golește” începe de la zero.", "ok", 5000);
    } catch (e) { console.warn("Sesiunea anexei nu a putut fi refăcută", e); }
    finally { restoring = false; }
  }

  function render() {
    var nm = numberMap(), only = $("onlySel").checked;
    grid.innerHTML = "";
    var frag = document.createDocumentFragment();
    if (mode === "pdf") {
      var gs = docGroups();
      items = [].concat.apply([], gs.map(function (g) { return g.items; })); // paginile rămân grupate pe document
      var dn = docNumbers();
      gs.forEach(function (g, i) {
        var doc = g.items[0].doc;
        frag.appendChild(docCard(g, i, gs.length, doc ? dn[doc.id] : "", nm, only));
      });
    } else {
      items.forEach(function (it) {
        if (only && !it.sel) return;
        frag.appendChild(cardHtml(it, nm[it.id]));
      });
    }
    grid.appendChild(frag);
    var n = items.length, ns = selected().length;
    $("drop").classList.toggle("has", n > 0);
    $("toolbar").hidden = n === 0; $("hint").hidden = n === 0; $("btnClear").hidden = n === 0;
    $("tabCount").textContent = n ? ns + "/" + n : "0";
    if (n && !$("srcInfo").textContent.startsWith("Se încarcă")) {
      $("srcInfo").textContent = (S._lastFolder ? "📁 " + S._lastFolder + " · " : "") + plural(n, M().one[0], M().one[1]) + " · " + ns + " bifate";
    } else if (!n) $("srcInfo").textContent = "";
    $("sortSel").value = sortMode;
    renderDocs();
    renderFooter();
    if ($("tab-preview").classList.contains("on")) renderPreview();
    else updatePageCount();
  }

  function updatePageCount() {
    $("tabPages").textContent = paginate(selected()).length;
  }

  function renderFooter() {
    var ns = selected().length;
    var pages = paginate(selected()).length, nd = Object.keys(docNumbers()).length;
    $("btnInsert").disabled = busy || ns === 0;
    $("btnInsert").textContent = busy ? "Se inserează…" : (!ns ? "Inserează în document" :
      mode === "pdf" ? "Inserează " + plural(ns, "pagină", "pagini") + " · " + plural(nd, "document", "documente") :
      "Inserează " + plural(ns, "poză", "poze") + " · " + plural(pages, "pagină", "pagini"));
    $("existing").hidden = !(inWord && hasExisting);
    $("footInfo").textContent = inWord ? (hasExisting && $("replaceExisting").checked ? "Anexa existentă va fi înlocuită." : "Se inserează la poziția cursorului.") : "Deschide din Word pentru a insera.";
    updatePageCount();
  }

  // ---------- interacțiuni listă ----------
  function byId(id) { id = +id; for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i]; return null; }

  async function rotate(it) {
    it.rot = (it.rot + 90) % 360; it.userRot = true; it.autoRot = false;
    it.thumb = await rotateDataUrl(it.thumb0, it.rot);
    updateCard(it);
    if ($("tab-preview").classList.contains("on")) renderPreview();
  }

  function wireGrid() {
    grid.addEventListener("click", function (e) {
      var card = e.target.closest(".card-ph"); if (!card) return;
      var it = byId(card.dataset.id); if (!it) return;
      var a = e.target.closest("[data-a]");
      if (a) {
        e.stopPropagation();
        if (a.dataset.a === "rot") rotate(it);
        else if (a.dataset.a === "del") { items = items.filter(function (x) { return x !== it; }); render(); }
        else if (a.dataset.a === "zoom") openLb(items.indexOf(it));
        return;
      }
      if (e.target.closest(".th") && !it.bad) {
        it.sel = !it.sel;
        if ($("onlySel").checked && !it.sel) render();
        else refreshMarks();
      }
    });
    grid.addEventListener("dblclick", function (e) {
      var card = e.target.closest(".card-ph"); if (!card || !e.target.closest(".th")) return;
      var it = byId(card.dataset.id);
      if (it) openLb(items.indexOf(it)); // cele două click-uri s-au anulat reciproc
    });
    grid.addEventListener("input", function (e) {
      if (e.target.dataset && e.target.dataset.d === "title") {
        var g = e.target.closest(".dcard"), gi = docGroups().filter(function (x) { return x.key === g.dataset.k; })[0];
        if (gi && gi.items[0].doc) gi.items[0].doc.title = e.target.value;
        return;
      }
      if (e.target.tagName !== "INPUT" || !e.target.closest(".card-ph")) return;
      var it = byId(e.target.closest(".card-ph").dataset.id); if (it) it.desc = e.target.value;
    });
    grid.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" && e.key === "Enter") {
        var cards = Array.prototype.slice.call(grid.querySelectorAll(".card-ph input"));
        var i = cards.indexOf(e.target); if (cards[i + 1]) cards[i + 1].focus();
      }
    });

    // reordonare prin drag & drop
    var dragId = null;
    grid.addEventListener("dragstart", function (e) {
      var card = e.target.closest && e.target.closest(".card-ph");
      if (!card || e.target.tagName === "INPUT") return;
      dragId = +card.dataset.id; card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", String(dragId)); } catch (x) { }
    });
    grid.addEventListener("dragend", function () {
      dragId = null;
      grid.querySelectorAll(".dragging,.drop-before,.drop-after").forEach(function (c) { c.classList.remove("dragging", "drop-before", "drop-after"); });
    });
    grid.addEventListener("dragover", function (e) {
      if (dragId == null) return;
      e.preventDefault(); e.stopPropagation();
      var card = e.target.closest(".card-ph");
      grid.querySelectorAll(".drop-before,.drop-after").forEach(function (c) { c.classList.remove("drop-before", "drop-after"); });
      if (!card || +card.dataset.id === dragId) return;
      var r = card.getBoundingClientRect();
      card.classList.add(e.clientX < r.left + r.width / 2 ? "drop-before" : "drop-after");
    });
    grid.addEventListener("drop", function (e) {
      if (dragId == null) return;
      e.preventDefault(); e.stopPropagation();
      var card = e.target.closest(".card-ph");
      if (card && +card.dataset.id !== dragId) {
        var r = card.getBoundingClientRect(), after = e.clientX >= r.left + r.width / 2;
        var mv = byId(dragId);
        items.splice(items.indexOf(mv), 1);
        var ti = items.indexOf(byId(card.dataset.id));
        items.splice(after ? ti + 1 : ti, 0, mv);
        sortMode = "manual";
      }
      dragId = null; render();
    });

    // fișiere trase din Explorer
    var drop = $("drop");
    drop.addEventListener("dragover", function (e) {
      if (dragId != null) return;
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") >= 0) { e.preventDefault(); drop.classList.add("over"); }
    });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", async function (e) {
      if (dragId != null) return;
      e.preventDefault(); drop.classList.remove("over");
      var dt = e.dataTransfer, list = [];
      if (dt.items && dt.items.length && dt.items[0].webkitGetAsEntry) {
        var entries = Array.prototype.map.call(dt.items, function (i) { return i.webkitGetAsEntry(); }).filter(Boolean);
        var lists = await Promise.all(entries.map(readEntries));
        list = [].concat.apply([], lists);
      } else list = dt.files;
      addFiles(list, false);
    });
  }

  // ---------- lightbox ----------
  var lbUrl = null;
  async function openLb(i) {
    if (i < 0 || i >= items.length) return;
    lbIndex = i;
    var it = items[i];
    $("lightbox").hidden = false;
    $("lbName").textContent = (i + 1) + " / " + items.length + " · " + label(it) + (it.w && it.kind !== "pdf" ? " · " + it.w + "×" + it.h : "");
    $("lbSel").checked = it.sel; $("lbDesc").value = it.desc;
    if (lbUrl) URL.revokeObjectURL(lbUrl);
    lbUrl = null;
    var img = $("lbImg");
    img.style.transform = it.rot ? "rotate(" + it.rot + "deg)" : "";
    if (it.kind === "pdf") {
      img.src = it.thumb0 || "";
      try {
        var c = await renderPdfPage(it, 1800);
        if (lbIndex === i) img.src = c.toDataURL("image/jpeg", 0.9);
        c.width = c.height = 0;
      } catch (e) { }
    } else {
      lbUrl = URL.createObjectURL(it.file);
      img.src = lbUrl;
    }
  }
  function closeLb() {
    $("lightbox").hidden = true; lbIndex = -1;
    if (lbUrl) { URL.revokeObjectURL(lbUrl); lbUrl = null; }
    render();
  }
  function wireLb() {
    $("lbClose").onclick = closeLb;
    $("lbPrev").onclick = function () { openLb(lbIndex - 1); };
    $("lbNext").onclick = function () { openLb(lbIndex + 1); };
    $("lbSel").onchange = function () { items[lbIndex].sel = this.checked; };
    $("lbDesc").oninput = function () { items[lbIndex].desc = this.value; };
    $("lbRot").onclick = async function () {
      var it = items[lbIndex]; await rotate(it);
      $("lbImg").style.transform = it.rot ? "rotate(" + it.rot + "deg)" : "";
    };
    document.addEventListener("keydown", function (e) {
      if ($("lightbox").hidden) return;
      if (e.target.id === "lbDesc" && e.key !== "Escape" && e.key !== "Enter") return;
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowLeft") openLb(lbIndex - 1);
      else if (e.key === "ArrowRight" || e.key === "Enter") openLb(lbIndex + 1);
      else if (e.key === " ") { e.preventDefault(); $("lbSel").click(); }
      else if (e.key.toLowerCase() === "r") $("lbRot").click();
    });
  }

  // ---------- setări (tab Aranjare) ----------
  function buildGridPicker() {
    var box = $("gridPick"); box.innerHTML = "";
    Object.keys(L.GRIDS).forEach(function (k) {
      var g = L.GRIDS[k], b = document.createElement("button");
      b.className = "gp"; b.dataset.n = k;
      var cells = "";
      for (var i = 0; i < g[0] * g[1]; i++) cells += "<i></i>";
      b.innerHTML = '<span class="pg" style="grid-template-columns:repeat(' + g[0] + ',1fr);grid-template-rows:repeat(' + g[1] + ',1fr)">' + cells + "</span>" + k + (mode === "pdf" ? (k == 1 ? " pagină" : " pagini") : (k == 1 ? " poză" : " poze"));
      b.onclick = function () { S.perPage = +k; changed(); };
      box.appendChild(b);
    });
  }

  function syncForm() {
    document.querySelectorAll(".gp").forEach(function (b) { b.classList.toggle("on", +b.dataset.n === S.perPage); });
    document.querySelectorAll("#fitSeg button").forEach(function (b) { b.classList.toggle("on", b.dataset.fit === S.fit); });
    document.querySelectorAll("#ratioSeg button").forEach(function (b) { b.classList.toggle("on", b.dataset.r === S.ratio); });
    $("cropOpts").hidden = S.fit !== "crop";
    $("ratioFollow").checked = !!S.ratioFollowOrientation;
    $("gapMm").value = S.gapMm; $("border").value = S.border;
    $("capOn").checked = S.caption.enabled; $("capOpts").classList.toggle("disabled", !S.caption.enabled);
    $("capPrefix").value = S.caption.prefix; $("capNum").checked = S.caption.numbering; $("capStart").value = S.caption.startAt;
    $("capSize").value = S.caption.fontSize; $("capLines").value = String(S.caption.lines);
    $("capBold").checked = S.caption.boldPrefix; $("capFile").checked = S.caption.useFileName;
    $("titleOn").checked = S.title.enabled; $("titleOpts").classList.toggle("disabled", !S.title.enabled);
    $("titleText").value = S.title.text; $("titleStyle").value = S.title.style; $("titleAlign").value = S.title.align;
    $("titleSize").value = S.title.fontSize; $("titleRepeat").checked = S.title.repeat;
    $("pageW").value = S.page.wCm; $("pageH").value = S.page.hCm;
    $("dpi").value = String(S.dpi); $("fontName").value = S.fontName; $("newPage").checked = !!S.startNewPage; $("autoRot").checked = !!S.autoRotate; $("autoRotRow").hidden = mode !== "pdf";
    $("dtOn").checked = !!S.docTitle.enabled; $("dtOpts").classList.toggle("disabled", !S.docTitle.enabled);
    $("dtPrefix").value = S.docTitle.prefix || ""; $("dtStyle").value = S.docTitle.style; $("dtAlign").value = S.docTitle.align;
    $("dtSize").value = S.docTitle.fontSize; $("dtRepeat").checked = !!S.docTitle.repeat;
    document.body.classList.toggle("cap-on", !!S.caption.enabled);
  }

  function num(v, d) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : d; }

  function readForm() {
    S.ratioFollowOrientation = $("ratioFollow").checked;
    S.gapMm = Math.max(0, num($("gapMm").value, 4)); S.border = $("border").value;
    S.caption.enabled = $("capOn").checked; S.caption.prefix = $("capPrefix").value;
    S.caption.numbering = $("capNum").checked; S.caption.startAt = Math.max(0, Math.round(num($("capStart").value, 1)));
    S.caption.fontSize = Math.min(14, Math.max(6, num($("capSize").value, 9))); S.caption.lines = +$("capLines").value;
    S.caption.boldPrefix = $("capBold").checked; S.caption.useFileName = $("capFile").checked;
    S.title.enabled = $("titleOn").checked; S.title.text = $("titleText").value; S.title.style = $("titleStyle").value;
    S.title.align = $("titleAlign").value; S.title.fontSize = Math.min(20, Math.max(8, num($("titleSize").value, 12)));
    S.title.repeat = $("titleRepeat").checked;
    S.page.wCm = Math.min(40, Math.max(5, num($("pageW").value, 17)));
    S.page.hCm = Math.min(50, Math.max(5, num($("pageH").value, 25.7)));
    S.dpi = +$("dpi").value; S.fontName = $("fontName").value.trim(); S.startNewPage = $("newPage").checked; S.autoRotate = $("autoRot").checked;
    S.docTitle.enabled = $("dtOn").checked; S.docTitle.prefix = $("dtPrefix").value; S.docTitle.style = $("dtStyle").value;
    S.docTitle.align = $("dtAlign").value; S.docTitle.fontSize = Math.min(20, Math.max(8, num($("dtSize").value, 11))); S.docTitle.repeat = $("dtRepeat").checked;
  }

  function changed() { saveSettings(); syncForm(); render(); }

  function wireForm() {
    buildGridPicker();
    document.querySelectorAll("#fitSeg button").forEach(function (b) { b.onclick = function () { S.fit = b.dataset.fit; changed(); }; });
    document.querySelectorAll("#ratioSeg button").forEach(function (b) { b.onclick = function () { S.ratio = b.dataset.r; changed(); }; });
    document.querySelectorAll("#tab-layout input, #tab-layout select").forEach(function (el) {
      el.addEventListener(el.type === "text" || el.type === "number" ? "input" : "change", async function () {
        readForm(); saveSettings(); syncForm();
        if (el.id === "autoRot" || el.id === "pageW" || el.id === "pageH") await applyAutoRotate(items);
        render();
      });
    });
    $("btnReset").onclick = function () { var lf = S._lastFolder; S = clone(M().defaults); S._lastFolder = lf; changed(); detectPage(true); };
    $("btnDetect").onclick = function () { detectPage(false); };
  }

  // ---------- previzualizare ----------
  var pvCols = 1;
  try { pvCols = +(localStorage.getItem("valuefy-anexa-pvcols-" + mode) || 1) || 1; } catch (e) { }

  function renderPreview() {
    var box = $("pages"); box.innerHTML = "";
    var sel = selected();
    updatePageCount();
    document.querySelectorAll("#pvZoom button").forEach(function (b) { b.classList.toggle("on", +b.dataset.c === pvCols); });
    if (!sel.length) { box.innerHTML = '<div class="pv-empty">Bifează ' + (mode === "pdf" ? "pagini" : "poze") + " în primul tab pentru a vedea paginile.</div>"; $("pvSummary").innerHTML = ""; return; }
    var pgs = paginate(sel), lay0 = L.computeLayout(S);

    // estimare mărime
    var bytes = 0;
    pgs.forEach(function (pg) {
      var lay = layFor(pg);
      pg.items.forEach(function (it) {
        var d = dims(it); if (!d.w) return;
        var ds = L.displaySize(lay, S, d.w, d.h);
        var px = (ds.wCm / 2.54 * S.dpi) * (ds.hCm / 2.54 * S.dpi);
        var srcPx = it.kind === "pdf" ? px : d.w * ds.crop.w * d.h * ds.crop.h;
        bytes += Math.min(px, srcPx) * (it.kind === "pdf" ? 0.12 : 0.28);
      });
    });
    var pages = pgs.length;
    $("pvSummary").innerHTML = mode === "pdf" ?
      "<b>" + plural(sel.length, "pagină", "pagini") + "</b> din <b>" + plural(Object.keys(docNumbers()).length, "document", "documente") + "</b> → <b>" + plural(pages, "pagină Word", "pagini Word") + "</b> · ~" + fmtMB(bytes * 1.33) + " în document" :
      "<b>" + plural(sel.length, "poză", "poze") + "</b> pe <b>" + plural(pages, "pagină", "pagini") +
      "</b> · " + lay0.cols + "×" + lay0.rows + " · imagine max. " + lay0.imgW.toFixed(1) + "×" + lay0.boxH.toFixed(1) + " cm · ~" + fmtMB(bytes * 1.33) + " în document";

    box.style.gridTemplateColumns = "repeat(" + pvCols + ", 1fr)";
    var gapPx = 12;
    var avail = ((box.clientWidth || 300) - gapPx * (pvCols - 1)) / pvCols - 2;
    var marginCm = 2, pageWcm = S.page.wCm + marginCm * 2, pageHcm = S.page.hCm + marginCm * 2;
    var k = avail / pageWcm; // px per cm
    var nm = numberMap();

    pgs.forEach(function (pgd, p) {
      var lay = layFor(pgd);
      var pg = document.createElement("div"); pg.className = "page";
      pg.style.width = pageWcm * k + "px"; pg.style.height = pageHcm * k + "px";
      var ox = marginCm * k, oy = marginCm * k;
      var html = '<div class="area" style="left:' + ox + "px;top:" + oy + "px;width:" + S.page.wCm * k + "px;height:" + S.page.hCm * k + 'px"></div>';
      var y = 0;
      if (lay.titleOn && (p === 0 || S.title.repeat)) {
        var t = S.title.text + (p > 0 ? S.title.repeatSuffix : "");
        html += '<div class="ttl" style="top:' + oy + "px;padding:0 " + ox + "px;font-size:" + S.title.fontSize * 0.03528 * k + "px;text-align:" + (S.title.align === "left" ? "left" : "center") + '">' + escapeHtml(t) + "</div>";
      }
      if (lay.titleOn) y += lay.titleH;
      if (pgd.docTitle) {
        html += '<div class="ttl dtt" style="top:' + (oy + y * k) + "px;padding:0 " + ox + "px;font-size:" + S.docTitle.fontSize * 0.03528 * k + "px;text-align:" + (S.docTitle.align === "center" ? "center" : "left") + '">' + escapeHtml(pgd.docTitle) + "</div>";
        y += lay.docTitleH;
      }
      var chunk = pgd.items;
      var nRows = Math.ceil(chunk.length / lay.cols);
      for (var r = 0; r < nRows; r++) {
        var row = chunk.slice(r * lay.cols, (r + 1) * lay.cols);
        var sizes = row.map(function (it) { var d = dims(it); return d.w ? L.displaySize(lay, S, d.w, d.h) : { wCm: lay.imgW, hCm: lay.boxH * .75, crop: { x: 0, y: 0, w: 1, h: 1 } }; });
        var rowH = Math.max.apply(null, sizes.map(function (s) { return s.hCm; }));
        var x = 0;
        row.forEach(function (it, c) {
          var s = sizes[c];
          var cellX = x + (c > 0 ? lay.gap / 2 : 0);
          var ix = cellX + (lay.imgW - s.wCm) / 2;
          var iy = y + (S.fit === "crop" ? 0 : (rowH - s.hCm) / 2);
          html += '<div class="im' + (S.border !== "none" ? " bd" : "") + '" data-id="' + it.id + '" style="left:' + (ox + ix * k) + "px;top:" + (oy + iy * k) + "px;width:" + s.wCm * k + "px;height:" + s.hCm * k + 'px">' +
            (it.thumb ? '<img src="' + it.thumb + '" style="object-fit:' + (S.fit === "crop" ? "cover" : "fill") + '"/>' : "") + "</div>";
          if (lay.capOn) {
            var ct = L.captionText(S, nm[it.id], descFor(it));
            var txt = ct.head + (ct.head && ct.desc ? S.caption.separator : "") + ct.desc;
            var capTop = y + (S.fit === "crop" ? s.hCm : (rowH + s.hCm) / 2) + S.caption.spaceBeforePt * 0.03528;
            html += '<div class="cap" style="left:' + (ox + cellX * k) + "px;width:" + lay.imgW * k + "px;top:" + (oy + capTop * k) + "px;font-size:" + Math.max(5, S.caption.fontSize * 0.03528 * k) + 'px">' + escapeHtml(txt) + "</div>";
          }
          x += lay.colW[c];
        });
        y += rowH + lay.capH + lay.gap;
      }
      html += '<span class="pn">pag. ' + (p + 1) + "/" + pages + "</span>";
      pg.innerHTML = html;
      box.appendChild(pg);
    });
  }

  /** Previzualizare: clic pe o imagine din pagină o deschide mare. */
  function wirePreview() {
    $("pages").addEventListener("dblclick", function (e) {
      var im = e.target.closest(".im"); if (!im) return;
      var it = byId(im.dataset.id); if (it) openLb(items.indexOf(it));
    });
    document.querySelectorAll("#pvZoom button").forEach(function (b) {
      b.onclick = function () {
        pvCols = +b.dataset.c;
        try { localStorage.setItem("valuefy-anexa-pvcols-" + mode, String(pvCols)); } catch (e) { }
        renderPreview();
      };
    });
  }

  // ---------- procesare imagine pentru document ----------
  async function loadSource(it, needK) {
    if (it.kind === "pdf") {
      var c = await renderPdfPage(it, 0, Math.max(0.2, needK * 1.02));
      return { el: c, w: c.width, h: c.height, done: function () { c.width = c.height = 0; } };
    }
    var r = await loadImg(it.file);
    return { el: r.img, w: r.img.naturalWidth, h: r.img.naturalHeight, done: function () { URL.revokeObjectURL(r.url); } };
  }

  async function processImage(it, ds) {
    var rot0 = it.rot || 0;
    var bw = rot0 % 180 ? it.h : it.w, bh = rot0 % 180 ? it.w : it.h;
    var needK = Math.min(Math.round(ds.wCm / 2.54 * S.dpi) / (bw * ds.crop.w), Math.round(ds.hCm / 2.54 * S.dpi) / (bh * ds.crop.h));
    var src = await loadSource(it, needK);
    try {
      var img = src.el, rot = rot0;
      var sw = src.w, sh = src.h;
      var rw = rot % 180 ? sh : sw, rh = rot % 180 ? sw : sh;         // dimensiuni după rotire
      var cropW = rw * ds.crop.w, cropH = rh * ds.crop.h;
      var tW = Math.round(ds.wCm / 2.54 * S.dpi), tH = Math.round(ds.hCm / 2.54 * S.dpi);
      var k = Math.min(1, tW / cropW, tH / cropH);                      // fără mărire
      var outW = Math.max(1, Math.round(cropW * k)), outH = Math.max(1, Math.round(cropH * k));

      // 1) imagine rotită, redusă la scara k (pentru memorie mică)
      var k2 = Math.min(1, k * 1.5);
      var c1 = document.createElement("canvas");
      c1.width = Math.max(1, Math.round(rw * k2)); c1.height = Math.max(1, Math.round(rh * k2));
      var g1 = c1.getContext("2d"); g1.imageSmoothingQuality = "high";
      g1.translate(c1.width / 2, c1.height / 2); g1.rotate(rot * Math.PI / 180);
      var dw = (rot % 180 ? c1.height : c1.width), dh = (rot % 180 ? c1.width : c1.height);
      g1.drawImage(img, -dw / 2, -dh / 2, dw, dh);

      // 2) decupaj + dimensiune finală
      var c2 = document.createElement("canvas"); c2.width = outW; c2.height = outH;
      var g2 = c2.getContext("2d"); g2.imageSmoothingQuality = "high";
      g2.fillStyle = "#fff"; g2.fillRect(0, 0, outW, outH);
      g2.drawImage(c1, ds.crop.x * c1.width, ds.crop.y * c1.height, ds.crop.w * c1.width, ds.crop.h * c1.height, 0, 0, outW, outH);
      var url = c2.toDataURL("image/jpeg", S.jpegQ);
      c1.width = c1.height = 0; c2.width = c2.height = 0;
      return url.slice(url.indexOf(",") + 1);
    } finally { src.done(); }
  }

  /**
   * Generează pachetele OOXML pagină cu pagină și le trimite la onChunk(xml, isFirst).
   */
  async function generate(onChunk, onProgress) {
    var sel = selected().filter(function (i) { return !i.bad; });
    var pgs = paginate(sel), pages = pgs.length, docTitles = [];
    var base = 1000 + Math.floor(Math.random() * 90000) * 100;
    var nm = numberMap();
    var body = "", media = [], bytes = 0, first = true, k = 0;

    async function flush() {
      if (!body) return;
      await onChunk(L.wrapPackage(body, media), first);
      first = false; body = ""; media = []; bytes = 0;
    }

    for (var p = 0; p < pages; p++) {
      var lay = layFor(pgs[p]);
      if (pgs[p].docTitle) docTitles.push(pgs[p].docTitle);
      var chunk = pgs[p].items, pItems = [];
      for (var j = 0; j < chunk.length; j++) {
        var it = chunk[j]; k++;
        onProgress && onProgress(k, sel.length, "Procesez " + it.name);
        var d = dims(it), ds = L.displaySize(lay, S, d.w, d.h);
        var b64 = await processImage(it, ds);
        var rid = "rIdVf" + k, file = "vf" + base + "_" + k + ".jpeg";
        media.push({ rid: rid, file: file, mime: "image/jpeg", b64: b64 });
        bytes += b64.length;
        var ct = S.caption.enabled ? L.captionText(S, nm[it.id], descFor(it)) : null;
        pItems.push({ rid: rid, wCm: ds.wCm, hCm: ds.hCm, docPrId: base + k,
          name: (ct && ct.head ? ct.head : (it.kind === "pdf" ? label(it) : "Foto " + nm[it.id])), caption: ct });
      }
      body += L.pageXml(lay, S, pItems, p, { docTitle: pgs[p].docTitle });
      if (bytes > CHUNK_BYTES) await flush();
    }
    await flush();
    return { photos: sel.length, pages: pages, docTitles: docTitles };
  }

  // ---------- Word ----------
  async function checkExisting() {
    if (!inWord) return;
    try {
      await Word.run(async function (ctx) {
        var ccs = ctx.document.contentControls.getByTag(M().tag); ccs.load("items"); await ctx.sync();
        hasExisting = ccs.items.length > 0;
      });
    } catch (e) { hasExisting = false; }
    renderFooter();
  }

  function attr(tag, name) { var m = tag.match(new RegExp("w:" + name + '="(-?\\d+)"')); return m ? Math.abs(+m[1]) : null; }

  async function detectPage(silent) {
    if (!inWord) { if (!silent) toast("Disponibil doar în Word."); return; }
    try {
      await Word.run(async function (ctx) {
        var ox = ctx.document.getSelection().getOoxml(); await ctx.sync();
        var x = ox.value, szs = x.match(/<w:pgSz\b[^>]*>/g), mars = x.match(/<w:pgMar\b[^>]*>/g);
        if (!szs || !mars) throw new Error("fără sectPr");
        var sz = szs[szs.length - 1], mar = mars[mars.length - 1];
        var W = attr(sz, "w"), H = attr(sz, "h"), land = /w:orient="landscape"/.test(sz);
        var l = attr(mar, "left") || 0, r = attr(mar, "right") || 0, t = attr(mar, "top") || 0, b = attr(mar, "bottom") || 0;
        var hdr = attr(mar, "header") || 0, ftr = attr(mar, "footer") || 0;
        S.page.wCm = +((W - l - r) / 566.929).toFixed(2);
        // lăsăm o marjă de siguranță pentru antet/subsol mai înalte decât marginea
        S.page.hCm = +((H - t - b) / 566.929 - 0.3).toFixed(2);
        saveSettings(); syncForm(); render();
        $("pageInfo").textContent = "Pagina " + (W / 566.929).toFixed(1) + "×" + (H / 566.929).toFixed(1) + " cm" + (land ? " (landscape)" : "") +
          ", margini " + (t / 566.929).toFixed(1) + "/" + (r / 566.929).toFixed(1) + "/" + (b / 566.929).toFixed(1) + "/" + (l / 566.929).toFixed(1) + " cm";
        if (!silent) toast("Dimensiunile paginii au fost citite din document.", "ok");
      });
    } catch (e) {
      if (!silent) toast("Nu am putut citi setările paginii. Completează manual.", "err");
    }
  }

  async function insertInWord() {
    var ns = selected().length; if (!ns || busy) return;
    busy = true; renderFooter();
    var prog = $("progress"), bar = prog.querySelector("i"), lbl = prog.querySelector("span");
    prog.hidden = false;
    var setP = function (k, n, t) { bar.style.width = Math.round(k / n * 100) + "%"; lbl.textContent = k + " / " + n + " · " + t; };
    try {
      var res;
      await Word.run(async function (ctx) {
        var cc = null, range = null;
        var replace = hasExisting && $("replaceExisting").checked;
        if (replace) {
          var ccs = ctx.document.contentControls.getByTag(M().tag); ccs.load("items"); await ctx.sync();
          if (ccs.items.length) cc = ccs.items[0];
        }
        if (!cc) {
          var para = ctx.document.getSelection().paragraphs.getFirst();
          para.load("text");
          var tnl = null;
          try { para.load("tableNestingLevel"); tnl = true; } catch (e) { }
          await ctx.sync();
          if (tnl && para.tableNestingLevel > 0) throw new Error("Cursorul este într-un tabel. Pune-l pe un rând gol, în afara tabelului.");
          var target = para;
          if (String(para.text).trim() !== "") target = para.insertParagraph("", "After");
          try {
            cc = target.insertContentControl();
            cc.tag = M().tag; cc.title = M().title; cc.appearance = "Hidden";
            await ctx.sync();
          } catch (e) {
            cc = null; range = target.getRange("Whole");
          }
        }
        res = await generate(async function (xml, isFirst) {
          lbl.textContent = "Inserez în document…";
          if (cc) cc.insertOoxml(xml, isFirst ? "Replace" : "End");
          else range = range.insertOoxml(xml, isFirst ? "Replace" : "After");
          await ctx.sync();
        }, setP);

        // stiluri Titlu 1/2/3 aplicate prin API (independent de limba Word-ului), ca să apară în cuprins
        var wantMain = S.title.enabled && S.title.text.trim() && S.title.style !== "bold";
        var wantDoc = mode === "pdf" && S.docTitle.enabled && S.docTitle.style !== "bold" && res.docTitles.length;
        if (cc && (wantMain || wantDoc)) {
          try {
            var ps = cc.paragraphs; ps.load("items/text"); await ctx.sync();
            var mainDone = false, set = {};
            res.docTitles.forEach(function (t) { set[t.trim()] = 1; });
            ps.items.forEach(function (pp) {
              var t = String(pp.text || "").trim(); if (!t) return;
              if (wantMain && !mainDone && t === S.title.text.trim()) {
                pp.styleBuiltIn = S.title.style; pp.alignment = S.title.align === "left" ? "Left" : "Centered"; mainDone = true;
              } else if (wantDoc && set[t]) {
                pp.styleBuiltIn = S.docTitle.style; pp.alignment = S.docTitle.align === "center" ? "Centered" : "Left";
              }
            });
            await ctx.sync();
          } catch (e) { /* versiune Word fără WordApi 1.3 – rămân text îngroșat */ }
        }
        if (cc) { cc.getRange("Start").select(); await ctx.sync(); }
      });
      hasExisting = true;
      track(mode === "pdf" ? "insert_pdf" : "insert_photo", { n: res.photos, pages: res.pages });
      toast("Gata: " + (mode === "pdf" ? plural(res.photos, "pagină inserată", "pagini inserate") : plural(res.photos, "poză inserată", "poze inserate")) + " pe " + plural(res.pages, "pagină", "pagini") + ".", "ok", 4000);
    } catch (e) {
      console.error(e);
      toast("Eroare la inserare: " + (e && e.message ? e.message : e), "err", 7000);
    } finally {
      busy = false; prog.hidden = true; bar.style.width = "0"; renderFooter();
    }
  }

  async function gotoExisting() {
    try {
      await Word.run(async function (ctx) {
        var ccs = ctx.document.contentControls.getByTag(M().tag); ccs.load("items"); await ctx.sync();
        if (ccs.items.length) { ccs.items[0].getRange("Start").select(); await ctx.sync(); }
      });
    } catch (e) { }
  }

  // ---------- pornire ----------
  function wireTabs() {
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
        document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("on", t.id === "tab-" + b.dataset.tab); });
        if (b.dataset.tab === "preview") renderPreview();
        $("tab-" + b.dataset.tab).parentNode.scrollTop = 0;
      };
    });
  }

  // ---------- listă documente (mod PDF) ----------
  function docGroups() {
    var order = [], map = {};
    items.forEach(function (it) {
      var k = it.doc ? "d" + it.doc.id : "i" + it.id;
      if (!map[k]) { map[k] = { key: k, name: it.doc ? it.doc.name : it.name, items: [] }; order.push(map[k]); }
      map[k].items.push(it);
    });
    return order;
  }
  function renderDocs() { var b = $("docs"); if (b) b.hidden = true; }
  function wireDocs() {
    grid.addEventListener("click", function (e) {
      var b = e.target.closest("[data-d]"); if (!b || b.dataset.d === "title") return;
      var row = b.closest(".dcard"), gs = docGroups(), gi = -1;
      gs.forEach(function (g, i) { if (g.key === row.dataset.k) gi = i; });
      if (gi < 0) return;
      var act = b.dataset.d;
      if (act === "tog") { var on = b.checked; gs[gi].items.forEach(function (x) { if (!x.bad) x.sel = on; }); }
      else if (act === "del") { gs.splice(gi, 1); }
      else if (act === "up" && gi > 0) { var t = gs[gi - 1]; gs[gi - 1] = gs[gi]; gs[gi] = t; }
      else if (act === "down" && gi < gs.length - 1) { var t2 = gs[gi + 1]; gs[gi + 1] = gs[gi]; gs[gi] = t2; }
      if (act !== "tog") { items = [].concat.apply([], gs.map(function (g) { return g.items; })); sortMode = "manual"; }
      render();
    });
  }

  function applyModeUi() {
    var pdf = mode === "pdf";
    document.body.classList.toggle("mode-pdf", pdf);
    $("tabItemsLbl").textContent = pdf ? "Documente" : "Poze";
    document.title = pdf ? "Anexă documente" : "Anexă foto";
    $("docTitleCard").hidden = !pdf; $("fitCard").classList.toggle("pdf", pdf);
    $("lblFolder").textContent = pdf ? "Folder" : "Alege folder";
    $("lblFiles").textContent = pdf ? "+ Adaugă PDF-uri" : "+ Fișiere";
    $("lblFiles").parentNode.classList.toggle("primary", pdf); $("lblFolder").parentNode.classList.toggle("primary", !pdf);
    if (pdf) $("lblFiles").parentNode.parentNode.insertBefore($("lblFiles").parentNode, $("lblFolder").parentNode);
    $("inFiles").setAttribute("accept", pdf ? ".pdf,application/pdf,image/*" : "image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif");
    $("emptyMain").innerHTML = pdf ? "<b>Adaugă documentele PDF</b> (extras CF, releveu, autorizație…)<br/>sau trage-le aici." : "<b>Alege folderul cu pozele</b> de la inspecție<br/>sau trage-le aici.";
    $("emptySub").textContent = pdf ? "Fiecare pagină apare separat: o poți bifa, muta, roti sau scoate. Merg și scanări JPG/PNG." : "JPG, PNG, WEBP. Pozele HEIC de pe iPhone trebuie exportate ca JPG.";
    $("hint").textContent = pdf ? "Click pe pagină = bifează/debifează · trage pentru a reordona · dublu-click = mărește" : "Click pe poză = bifează/debifează · trage pentru a reordona · dublu-click = mărește";
    $("appName").textContent = pdf ? "Anexă documente" : "Anexă foto";
    $("perPageTitle").textContent = pdf ? "Pagini de document pe o pagină Word" : "Poze pe pagină";
    document.querySelectorAll("#sortSel .ph").forEach(function (o) { o.hidden = pdf; });
  }

  function switchMode(m) {
    if (m === mode || busy) return;
    bags[mode] = { items: items, sortMode: sortMode };
    mode = m;
    try { localStorage.setItem("valuefy-anexa-mode", m); } catch (e) { }
    items = bags[m].items; sortMode = bags[m].sortMode;
    S = loadSettings(); hasExisting = false;
    applyModeUi(); syncForm(); render();
    restoreSession();
    if (inWord) { detectPage(true); checkExisting(); }
  }

  function init() {
    grid = $("grid");
    wireTabs(); wireGrid(); wireLb(); wireForm(); wireDocs(); wirePreview(); applyModeUi(); syncForm();
    if (mode === "pdf") $("thumbSize").value = 105;
    grid.style.setProperty("--ts", $("thumbSize").value + "px");
    $("thumbSize").oninput = function () { grid.style.setProperty("--ts", this.value + "px"); };

    $("inFolder").onchange = function () {
      var f = this.files; if (!f || !f.length) return;
      var first = f[0].webkitRelativePath || "", label = first.split("/")[0] || "folder";
      addFiles(f, true, label); this.value = "";
    };
    $("inFiles").onchange = function () { addFiles(this.files, false); this.value = ""; };
    $("btnClear").onclick = function () { items = []; S._lastFolder = ""; render(); };
    $("sortSel").onchange = function () { sortMode = this.value; applySort(); render(); };
    $("selAll").onclick = function () { items.forEach(function (i) { if (!i.bad) i.sel = true; }); render(); };
    $("selNone").onclick = function () { items.forEach(function (i) { i.sel = false; }); render(); };
    $("selInv").onclick = function () { items.forEach(function (i) { if (!i.bad) i.sel = !i.sel; }); render(); };
    $("onlySel").onchange = render;
    $("removeUnsel").onclick = function () {
      var n = items.filter(function (i) { return !i.sel; }).length;
      items = items.filter(function (i) { return i.sel; }); render();
      if (n) toast(plural(n, "element scos", "elemente scoase") + " din listă.");
    };
    $("replaceExisting").onchange = renderFooter;
    $("btnGoto").onclick = gotoExisting;
    $("btnInsert").onclick = function () {
      if (inWord) insertInWord();
      else toast("Panoul rulează în afara Word (mod demo). Deschide-l din Word → tab-ul UVALO → " + M().title + ".");
    };
    window.addEventListener("resize", function () { if ($("tab-preview").classList.contains("on")) renderPreview(); });
    render();
    restoreSession();
  }

  // fiecare schimbare (listă, ordine, bife, descrieri, titluri) se păstrează
  var render0 = render;
  render = function () { render0(); scheduleSave(); };
  document.addEventListener("input", scheduleSave, true);
  document.addEventListener("change", scheduleSave, true);

  // expus pentru teste
  window.AnexaApp = {
    get items() { return items; }, get settings() { return S; }, get mode() { return mode; }, switchMode: switchMode,
    set: function (o) { S = merge(S, o); saveSettings(); syncForm(); render(); },
    addFiles: addFiles, generate: generate, renderPreview: renderPreview
  };

  document.addEventListener("DOMContentLoaded", function () {
    init();
    var ready = function (host) {
      inWord = !!(window.Office && host === Office.HostType.Word);
      $("modeBadge").hidden = inWord;
      if (inWord) {
        if (!Office.context.requirements.isSetSupported("WordApi", "1.1")) toast("Versiunea de Word nu suportă această funcție.", "err");
        detectPage(true); checkExisting();
        try { Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, debounce(checkExisting, 1500)); } catch (e) { }
      }
      renderFooter();
    };
    if (window.Office && Office.onReady) Office.onReady(function (info) { ready(info && info.host); });
    else ready(null);
  });

  // folosirea, în statisticile UVALO (Admin → Instrumente)
  function track(action, meta) {
    try {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ module: "word", events: [{ action: action, meta: meta }] }) }).catch(function () { });
    } catch (e) { }
  }

  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
})();
