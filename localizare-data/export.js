/* VALUEFY · Căutare cadastrală — completări la pagina primită:
   1. export fișă de localizare (PDF, Word, PNG) pentru parcela / construcția afișată;
   2. localizare multiplă: mai multe numere cadastrale separate prin virgulă → doar acele parcele pe hartă.
   Script separat de pagină: folosește variabilele și funcțiile globale ale paginii (U, P, BL, byId, cur, map, all, bL,
   sel, lblL, show, loadUat, geom, fmt, toast, $) fără să le modifice codul. */
(() => {
  "use strict";
  const NAVY = "#17173A", GOLD = "#F2A93B", INK = "#17173A", MUTED = "#4A4A66", LINE = "#E2D8C4", CREAM = "#FBF8F2";
  const FONT = "Verdana, Geneva, sans-serif", MONO = "ui-monospace, Menlo, Consolas, monospace";
  const LIBS = {
    pdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
    docx: "https://cdn.jsdelivr.net/npm/docx@9.5.1/dist/index.iife.js",
  };
  const DISCLAIMER = "Informații orientative, extrase din planul cadastral (BCPI Timiș). Nu înlocuiesc extrasul de carte funciară sau documentația cadastrală.";

  /* ---------- utilitare ---------- */
  const isBuilding = (o) => o && o.id === undefined;
  const today = () => new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const nf = (n, d) => (typeof fmt === "function" ? fmt(n, d) : n.toFixed(d));
  const safe = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_");
  const say = (m) => { try { toast(m); } catch { /* pagina fără toast */ } };
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("lib")); document.head.append(s);
  });
  const loadImg = (src, cors) => new Promise((res) => {
    const i = new Image(); if (cors) i.crossOrigin = "anonymous";
    const t = setTimeout(() => res(null), 9000);
    i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); res(null); }; i.src = src;
  });
  const save = (blob, name) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const toBlob = (c, type = "image/png", q) => new Promise((r) => c.toBlob(r, type, q));

  /* ---------- datele fișei ---------- */
  function sheetData(o) {
    if (o.multi) return multiData(o);
    const g = geom(o);
    const b = isBuilding(o);
    const parent = b && o.p >= 0 ? P[o.p] : null;
    const coords = o.s.map((s, k) => [String(k + 1), s[1].toFixed(3), s[0].toFixed(3), o.w[k][0].toFixed(7), o.w[k][1].toFixed(7), g.seg[k].toFixed(3)]);
    const center = b ? o.cc || [(o.bb[0] + o.bb[2]) / 2, (o.bb[1] + o.bb[3]) / 2] : o.c;
    const d = {
      kind: b ? "Construcție" : "Imobil",
      title: b ? `Construcția ${o.c || "—"}` : `Nr. cadastral ${o.id}`,
      subtitle: `UAT ${U.name} · județul Timiș${parent ? ` · pe nr. cad. ${parent.id}` : ""}`,
      file: b ? `Localizare_${safe(o.c || "constructie")}_${parent ? parent.id : ""}_${U.key}` : `Localizare_${o.id}_${U.key}`,
      facts: [[b ? "Arie la sol" : "Suprafață", `${nf(o.a, 2)} mp`], ["Perimetru", `${nf(g.per, 2)} m`], ["Puncte de contur", String(o.s.length)]],
      notes: [], sections: [], rows: coords, cols: COLS, tableTitle: "Inventar de coordonate · Stereo 70 și WGS84",
      total: `S = ${nf(o.a, 2)} mp    P = ${nf(g.per, 3)} m`,
      center: `${center[0].toFixed(7)}, ${center[1].toFixed(7)}`,
    };
    if (!b) {
      const bs = o.bs || [], tot = bs.reduce((s, x) => s + x.a, 0);
      d.facts.push(["Construcții", bs.length ? `${bs.length} · ${nf(tot, 2)} mp` : "0"]);
      d.notes.push(o.iv ? `În intravilanul istoric al localității ${o.iv} (plan 1:5000).` : "În afara intravilanului istoric din plan. Poate fi totuși intravilan prin PUG/PUZ — verifică în extrasul CF.");
      if (bs.length) d.sections.push({ h: "Construcții (amprentă la sol)", lines: bs.map((x) => `${x.c || "—"}: ${nf(x.a, 2)} mp`).concat([`Total la sol ${nf(tot, 2)} mp · POT ${nf((100 * tot) / o.a, 1)}%`]) });
      if (o.t && o.t.length) d.sections.push({ h: "Nr. topo (orientativ)", lines: [o.t.join(", ")] });
      if (o.n && o.n.length) d.sections.push({ h: `Vecini (${o.n.length})`, lines: [o.n.join(", ")] });
    } else if (parent) {
      const tot = (parent.bs || []).reduce((s, x) => s + x.a, 0);
      d.notes.push(`Pe parcela ${parent.id}: ${parent.bs.length} construcții, total la sol ${nf(tot, 2)} mp din ${nf(parent.a, 2)} mp teren · POT ${nf((100 * tot) / parent.a, 1)}%.`);
    }
    return d;
  }

  const MCOLS = [["Nr. cadastral", 190], ["Suprafață [mp]", 190], ["Perimetru [m]", 170], ["Construcții", 140], ["Intravilan ist.", 160], ["Centru (WGS84)", 250]];

  /** Sheet of a multiple location: every parcel found, with totals and the numbers not found. */
  function multiData(m) {
    const tot = m.items.reduce((s, p) => s + p.a, 0);
    const blds = m.items.reduce((s, p) => s + (p.bs ? p.bs.length : 0), 0);
    const notes = [];
    if (m.missing.length) notes.push(`Nu apar în planul pentru ${U.name}: ${m.missing.join(", ")}.`);
    const c = [(m.bb[0] + m.bb[2]) / 2, (m.bb[1] + m.bb[3]) / 2];
    return {
      kind: "Localizare multiplă", title: `${m.items.length} imobile`, subtitle: `UAT ${U.name} · județul Timiș`,
      file: `Localizare_multipla_${m.items.length}_imobile_${U.key}`,
      facts: [["Imobile găsite", `${m.items.length} din ${m.items.length + m.missing.length}`], ["Suprafață totală", `${nf(tot, 2)} mp`], ["Construcții", String(blds)], ["Negăsite", String(m.missing.length)]],
      notes, sections: [], cols: MCOLS, tableTitle: "Imobilele localizate",
      rows: m.items.map((p) => [p.id, nf(p.a, 2), nf(geom(p).per, 2), String(p.bs ? p.bs.length : 0), p.iv ? "da" : "nu", `${p.c[0].toFixed(5)}, ${p.c[1].toFixed(5)}`]),
      total: `Total: ${m.items.length} imobile · S = ${nf(tot, 2)} mp`,
      center: `${c[0].toFixed(7)}, ${c[1].toFixed(7)}`,
    };
  }

  /* ---------- harta (satelit + plan cadastral) ---------- */
  const TS = 256;
  const lx = (lng, z) => ((lng + 180) / 360) * TS * 2 ** z;
  const ly = (lat, z) => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TS * 2 ** z; };

  async function mapCanvas(o, W, H) {
    const multi = !!o.multi, items = multi ? o.items : [o];
    const parent = !multi && isBuilding(o) && o.p >= 0 ? P[o.p] : null;
    const bb = multi ? o.bb : parent ? [Math.min(o.bb[0], parent.bb[0]), Math.min(o.bb[1], parent.bb[1]), Math.max(o.bb[2], parent.bb[2]), Math.max(o.bb[3], parent.bb[3])] : o.bb;
    let z = 20;
    while (z > 3 && ((lx(bb[3], z) - lx(bb[1], z)) * 1.6 > W || (ly(bb[0], z) - ly(bb[2], z)) * 1.6 > H)) z--;
    const cx = (lx(bb[1], z) + lx(bb[3], z)) / 2, cy = (ly(bb[0], z) + ly(bb[2], z)) / 2;
    const ox = cx - W / 2, oy = cy - H / 2;
    const pt = (w) => [lx(w[1], z) - ox, ly(w[0], z) - oy];
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = NAVY; x.fillRect(0, 0, W, H);

    // Satelit (Esri World Imagery): plăcile se încarcă cu CORS; dacă nu se pot folosi, harta rămâne doar cu planul cadastral.
    const tz = Math.min(z, 19), f = 2 ** (z - tz), size = TS * f;
    const tiles = [];
    for (let tx = Math.floor(ox / size); tx <= Math.floor((ox + W) / size); tx++)
      for (let ty = Math.floor(oy / size); ty <= Math.floor((oy + H) / size); ty++)
        tiles.push(loadImg(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tz}/${ty}/${tx}`, true).then((img) => ({ img, tx, ty })));
    let imagery = 0;
    for (const t of await Promise.all(tiles)) if (t.img) { x.drawImage(t.img, t.tx * size - ox, t.ty * size - oy, size, size); imagery++; }
    try { x.getImageData(0, 0, 1, 1); } catch { x.fillStyle = NAVY; x.fillRect(0, 0, W, H); imagery = 0; }
    if (imagery) { x.fillStyle = "rgba(17,17,48,.18)"; x.fillRect(0, 0, W, H); }

    const path = (w) => { x.beginPath(); w.forEach((p, i) => { const [a, b] = pt(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); };
    const vis = (q) => q.bb && !(q.bb[2] < (bb[0] - 0.01) || q.bb[0] > bb[2] + 0.01 || q.bb[3] < bb[1] - 0.01 || q.bb[1] > bb[3] + 0.01);
    const inView = (q) => { const a = pt([q.bb[0], q.bb[1]]), b = pt([q.bb[2], q.bb[3]]); return Math.max(a[0], b[0]) > 0 && Math.min(a[0], b[0]) < W && Math.max(a[1], b[1]) > 0 && Math.min(a[1], b[1]) < H; };
    // Parcelele din jur și construcțiile
    x.lineWidth = 1.2; x.strokeStyle = "rgba(255,255,255,.6)";
    // La localizarea multiplă se văd doar parcelele cerute; restul planului rămâne doar ca fir subțire.
    if (multi) { x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = 1; }
    for (const q of P) if (!items.includes(q) && q !== parent && vis(q) && inView(q)) { path(q.w); x.stroke(); }
    if (!multi) for (const q of BL || []) if (q !== o && vis(q) && inView(q)) { path(q.w); x.fillStyle = "rgba(227,38,46,.45)"; x.fill(); x.strokeStyle = "rgba(255,210,31,.8)"; x.lineWidth = 1; x.stroke(); }
    if (parent) { path(parent.w); x.setLineDash([10, 7]); x.strokeStyle = GOLD; x.lineWidth = 2.5; x.stroke(); x.setLineDash([]); }
    // Conturul selectat (sau conturele, la localizarea multiplă)
    for (const it of items) {
      path(it.w);
      x.fillStyle = isBuilding(it) ? "rgba(227,38,46,.55)" : multi ? "rgba(242,169,59,.35)" : "rgba(242,169,59,.22)"; x.fill();
      x.strokeStyle = isBuilding(it) ? "#FFD21F" : GOLD; x.lineWidth = multi ? 3 : 4; x.lineJoin = "round"; x.stroke();
    }
    if (multi) {
      // Numărul cadastral pe fiecare parcelă
      x.font = `bold 17px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
      for (const it of items) {
        const [a, b] = pt(it.c), tw = x.measureText(it.id).width + 18;
        x.fillStyle = "rgba(255,255,255,.95)"; x.beginPath(); x.roundRect ? x.roundRect(a - tw / 2, b - 15, tw, 30, 15) : x.rect(a - tw / 2, b - 15, tw, 30); x.fill();
        x.strokeStyle = GOLD; x.lineWidth = 2; x.stroke(); x.fillStyle = NAVY; x.fillText(it.id, a, b + 1);
      }
    }
    // Puncte numerotate
    if (!multi && o.w.length <= 80) {
      const r = o.w.length > 40 ? 10 : 13;
      x.font = `bold ${r}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
      o.w.forEach((w, k) => { const [a, b] = pt(w); x.beginPath(); x.arc(a, b, r, 0, 2 * Math.PI); x.fillStyle = GOLD; x.fill(); x.lineWidth = 2; x.strokeStyle = NAVY; x.stroke(); x.fillStyle = NAVY; x.fillText(String(k + 1), a, b + 1); });
    }
    // Nord și scară
    x.save(); x.translate(W - 46, 52);
    x.fillStyle = "rgba(255,255,255,.92)"; x.beginPath(); x.arc(0, 0, 28, 0, 2 * Math.PI); x.fill();
    x.fillStyle = NAVY; x.beginPath(); x.moveTo(0, -20); x.lineTo(10, 8); x.lineTo(0, 3); x.lineTo(-10, 8); x.closePath(); x.fill();
    x.font = `bold 13px ${FONT}`; x.textAlign = "center"; x.fillText("N", 0, 22); x.restore();
    const lat = (bb[0] + bb[2]) / 2, mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((m) => m / mpp > W * 0.12) || 5000;
    const len = nice / mpp;
    x.fillStyle = "rgba(255,255,255,.92)"; x.fillRect(16, H - 60, len + 32, 44);
    x.fillStyle = NAVY; x.fillRect(32, H - 28, len, 6); x.font = `bold 17px ${FONT}`; x.textAlign = "left"; x.textBaseline = "alphabetic";
    x.fillText(`${nice >= 1000 ? nice / 1000 + " km" : nice + " m"}`, 32, H - 36);
    const attr = imagery ? "Imagini © Esri, Maxar, Earthstar Geographics · Plan cadastral BCPI Timiș" : "Plan cadastral BCPI Timiș (imaginea satelit nu a putut fi încărcată)";
    x.font = `15px ${FONT}`; const aw = x.measureText(attr).width;
    x.fillStyle = "rgba(255,255,255,.85)"; x.fillRect(W - aw - 24, H - 30, aw + 24, 30); x.fillStyle = MUTED; x.fillText(attr, W - aw - 12, H - 10);
    return { canvas: c, imagery: !!imagery };
  }

  /* ---------- fișa ca imagine (PNG, paginile PDF) ---------- */
  const PW = 1240, PH = 1754, M = 70; // A4 la 150 dpi
  const COLS = [["Pct.", 70], ["X [m]", 190], ["Y [m]", 190], ["Latitudine", 210], ["Longitudine", 210], ["D(i,i+1) [m]", 230]];

  function wrap(x, text, w) {
    const words = String(text).split(/\s+/), lines = []; let line = "";
    for (const wd of words) { const t = line ? line + " " + wd : wd; if (x.measureText(t).width > w && line) { lines.push(line); line = wd; } else line = t; }
    if (line) lines.push(line); return lines;
  }

  /** Blocks of the sheet; each knows its height and draws itself at y. */
  function blocks(d, map, logo, x) {
    const W = PW - 2 * M, out = [];
    out.push({ h: 104, draw: (y) => {
      x.fillStyle = NAVY; x.fillRect(0, 0, PW, y + 74);
      if (logo) { x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(M, y + 4, 230, 56, 12) : x.rect(M, y + 4, 230, 56); x.fill(); x.drawImage(logo, M + 14, y + 13, 202, (202 * logo.height) / logo.width); }
      x.fillStyle = GOLD; x.font = `bold 16px ${FONT}`; x.textAlign = "right"; x.fillText("FIȘĂ DE LOCALIZARE CADASTRALĂ", PW - M, y + 28);
      x.fillStyle = "#C9CAE0"; x.font = `15px ${FONT}`; x.fillText(`generată ${today()} · valuefy.ro`, PW - M, y + 54); x.textAlign = "left";
    } });
    out.push({ h: 104, draw: (y) => {
      x.fillStyle = "#9A5F00"; x.font = `bold 15px ${FONT}`; x.fillText(d.kind.toUpperCase() + " · " + U.name.toUpperCase(), M, y + 18);
      x.fillStyle = INK; x.font = `bold 40px ${FONT}`; x.fillText(d.title, M, y + 64);
      x.fillStyle = MUTED; x.font = `17px ${FONT}`; x.fillText(`${d.subtitle} · centru ${d.center} (WGS84)`, M, y + 94);
    } });
    const mh = Math.round((W * map.height) / map.width);
    out.push({ h: mh + 28, draw: (y) => { x.save(); x.beginPath(); x.roundRect ? x.roundRect(M, y, W, mh, 18) : x.rect(M, y, W, mh); x.clip(); x.drawImage(map, M, y, W, mh); x.restore(); } });
    const fw = (W - 18 * (d.facts.length - 1)) / d.facts.length;
    out.push({ h: 112, draw: (y) => d.facts.forEach(([k, v], i) => {
      const fx = M + i * (fw + 18);
      x.fillStyle = CREAM; x.strokeStyle = LINE; x.lineWidth = 2; x.beginPath(); x.roundRect ? x.roundRect(fx, y, fw, 90, 14) : x.rect(fx, y, fw, 90); x.fill(); x.stroke();
      x.fillStyle = MUTED; x.font = `15px ${FONT}`; x.fillText(k, fx + 18, y + 32);
      x.fillStyle = INK; x.font = `bold 22px ${MONO}`; x.fillText(v, fx + 18, y + 68);
    }) });
    x.font = `17px ${FONT}`;
    for (const n of d.notes) {
      const lines = wrap(x, n, W - 40);
      out.push({ h: lines.length * 26 + 34, draw: (y) => {
        x.fillStyle = "#FDF1DC"; x.beginPath(); x.roundRect ? x.roundRect(M, y, W, lines.length * 26 + 20, 12) : x.rect(M, y, W, lines.length * 26 + 20); x.fill();
        x.fillStyle = INK; x.font = `17px ${FONT}`; lines.forEach((l, i) => x.fillText(l, M + 20, y + 30 + i * 26));
      } });
    }
    for (const s of d.sections) {
      x.font = `16px ${FONT}`;
      const lines = s.lines.flatMap((l) => wrap(x, l, W));
      out.push({ h: 44 + lines.length * 25 + 14, draw: (y) => {
        x.fillStyle = "#9A5F00"; x.font = `bold 15px ${FONT}`; x.fillText(s.h.toUpperCase(), M, y + 24);
        x.fillStyle = INK; x.font = `16px ${FONT}`; lines.forEach((l, i) => x.fillText(l, M, y + 52 + i * 25));
      } });
    }
    out.push({ h: 58, table: "head", draw: (y) => {
      x.fillStyle = "#9A5F00"; x.font = `bold 15px ${FONT}`; x.fillText(d.tableTitle.toUpperCase(), M, y + 22);
      x.fillStyle = NAVY; x.fillRect(M, y + 32, W, 26); x.fillStyle = "#fff"; x.font = `bold 13px ${FONT}`;
      let cx = M; d.cols.forEach(([t, w]) => { x.fillText(t, cx + 10, y + 50); cx += w; });
    } });
    d.rows.forEach((r, i) => out.push({ h: 30, row: true, draw: (y) => {
      if (i % 2) { x.fillStyle = CREAM; x.fillRect(M, y, W, 30); }
      x.fillStyle = INK; x.font = `14px ${MONO}`; let cx = M; r.forEach((v, j) => { x.fillText(v, cx + 10, y + 20); cx += d.cols[j][1]; });
    } }));
    out.push({ h: 44, draw: (y) => { x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(M, y + 2); x.lineTo(M + W, y + 2); x.stroke(); x.fillStyle = INK; x.font = `bold 15px ${MONO}`; x.fillText(d.total, M + 10, y + 28); } });
    return out;
  }

  function drawFooter(x, page, pages, H) {
    x.font = `13px ${FONT}`; x.fillStyle = MUTED;
    const lines = wrap(x, DISCLAIMER, PW - 2 * M - 120);
    lines.forEach((l, i) => x.fillText(l, M, H - 50 + i * 18));
    if (pages > 1) { x.textAlign = "right"; x.fillText(`${page} / ${pages}`, PW - M, H - 50); x.textAlign = "left"; }
  }

  /** Pages of the sheet: `pageH` = A4 height for the PDF, or null for one long PNG. */
  async function render(o, pageH) {
    const d = sheetData(o);
    const [{ canvas: map, imagery }, logo] = await Promise.all([mapCanvas(o, 1500, 860), loadImg("/valuefy-logo.png", false)]);
    const measure = document.createElement("canvas").getContext("2d");
    const list = blocks(d, map, logo, measure);
    const foot = 76, top = M, bottom = (h) => h - foot;
    // Paginare: blocurile întregi trec pe pagina următoare; rândurile tabelului reiau capul de tabel.
    const pages = [[]]; let y = top;
    const head = list.find((b) => b.table === "head");
    for (const b of list) {
      if (pageH && y + b.h > bottom(pageH) && pages[pages.length - 1].length) {
        pages.push([]); y = top;
        if (b.row) { pages[pages.length - 1].push({ b: head, y }); y += head.h; }
      }
      pages[pages.length - 1].push({ b, y }); y += b.h;
    }
    const H = pageH || y + foot;
    return { d, imagery, canvases: pages.map((items, i) => {
      const c = document.createElement("canvas"); c.width = PW; c.height = H;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, PW, H); x.textBaseline = "alphabetic";
      const real = blocks(d, map, logo, x);
      items.forEach(({ b, y }) => real[list.indexOf(b)].draw(y));
      drawFooter(x, i + 1, pages.length, H);
      return c;
    }), map };
  }

  /* ---------- formatele ---------- */
  async function asPNG(o) {
    const r = await render(o, null);
    save(await toBlob(r.canvases[0]), r.d.file + ".png");
    return r;
  }

  async function asPDF(o) {
    await loadScript(LIBS.pdf);
    const r = await render(o, PH);
    const pdf = new window.jspdf.jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
    r.canvases.forEach((c, i) => { if (i) pdf.addPage(); pdf.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297); });
    pdf.setProperties({ title: `${r.d.title} · ${U.name}`, subject: "Fișă de localizare cadastrală", author: "VALUEFY" });
    save(pdf.output("blob"), r.d.file + ".pdf");
    return r;
  }

  async function asWord(o) {
    await loadScript(LIBS.docx);
    const D = window.docx;
    const d = sheetData(o);
    const [{ canvas: map, imagery }, logoImg] = await Promise.all([mapCanvas(o, 1500, 860), loadImg("/valuefy-logo.png", false)]);
    const png = async (c) => new Uint8Array(await (await toBlob(c)).arrayBuffer());
    let logo = null;
    if (logoImg) { const c = document.createElement("canvas"); c.width = logoImg.width; c.height = logoImg.height; c.getContext("2d").drawImage(logoImg, 0, 0); logo = await png(c); }
    const T = (text, o2 = {}) => new D.TextRun({ text, font: "Verdana", size: 20, color: "17173A", ...o2 });
    const P_ = (runs, o2 = {}) => new D.Paragraph({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: 120 }, ...o2 });
    const H_ = (text) => P_(T(text.toUpperCase(), { bold: true, size: 18, color: "9A5F00" }), { spacing: { before: 240, after: 100 } });
    const border = { style: D.BorderStyle.SINGLE, size: 4, color: "E2D8C4" };
    const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
    const cell = (text, o2 = {}) => new D.TableCell({ children: [P_(T(text, { size: o2.size || 18, bold: o2.bold, color: o2.color, font: o2.font }), { spacing: { after: 0 } })], shading: o2.fill ? { type: D.ShadingType.CLEAR, fill: o2.fill, color: "auto" } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 } });
    const facts = new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders,
      rows: [new D.TableRow({ children: d.facts.map(([k]) => cell(k, { fill: "FBF8F2", color: "4A4A66" })) }), new D.TableRow({ children: d.facts.map(([, v]) => cell(v, { bold: true, size: 22 })) })] });
    const coords = new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders,
      rows: [new D.TableRow({ tableHeader: true, children: d.cols.map(([t]) => cell(t, { bold: true, color: "FFFFFF", fill: "17173A" })) })]
        .concat(d.rows.map((r, i) => new D.TableRow({ children: r.map((v) => cell(v, { font: "Consolas", fill: i % 2 ? "FBF8F2" : undefined })) }))) });
    const children = [];
    if (logo) children.push(P_(new D.ImageRun({ type: "png", data: logo, transformation: { width: 150, height: Math.round((150 * logoImg.height) / logoImg.width) } })));
    children.push(
      P_(T(`FIȘĂ DE LOCALIZARE CADASTRALĂ · ${d.kind.toUpperCase()} · ${U.name.toUpperCase()}`, { bold: true, size: 16, color: "9A5F00" }), { spacing: { after: 60 } }),
      P_(T(d.title, { bold: true, size: 40 }), { spacing: { after: 60 } }),
      P_(T(`${d.subtitle} · generată ${today()}`, { color: "4A4A66" })),
      P_(new D.ImageRun({ type: "png", data: await png(map), transformation: { width: 620, height: 355 } })),
      P_(T(imagery ? "Imagini © Esri, Maxar, Earthstar Geographics · Plan cadastral BCPI Timiș" : "Plan cadastral BCPI Timiș", { size: 14, color: "6B6B85" })),
      facts,
      ...d.notes.concat([`Coordonate centru (WGS84): ${d.center}`]).map((n) => P_(T(n), { spacing: { before: 160, after: 0 } })),
    );
    for (const s of d.sections) children.push(H_(s.h), ...s.lines.map((l) => P_(T(l))));
    children.push(H_(d.tableTitle), coords, P_(T(d.total, { bold: true, font: "Consolas" }), { spacing: { before: 120 } }),
      P_(T(DISCLAIMER, { size: 16, color: "6B6B85", italics: true }), { spacing: { before: 240 } }));
    const doc = new D.Document({
      creator: "VALUEFY", title: `${d.title} · ${U.name}`, description: "Fișă de localizare cadastrală",
      sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children }],
    });
    save(await D.Packer.toBlob(doc), d.file + ".docx");
    return { imagery };
  }

  /* ---------- butoanele ---------- */
  const css = document.createElement("style");
  css.textContent = ".vfx{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0 4px;padding:12px 14px;border-radius:14px;background:#fdf1dc;border:1px solid #f5d9a6}" +
    ".vfx span{font-size:12.5px;font-weight:700;color:#9a5f00;margin-right:4px}.vfx button{height:36px;padding:0 14px;border-radius:999px;border:1px solid #e2d8c4;background:#fff;color:#17173a;font:700 13px Verdana,Geneva,sans-serif;cursor:pointer}" +
    ".vfx button:hover{border-color:#17173a}.vfx button:disabled{opacity:.55;cursor:progress}" +
    ".vfm-l{background:#fff;border:2px solid #f2a93b;border-radius:999px;color:#17173a;font:700 12px ui-monospace,Menlo,monospace;padding:2px 8px;box-shadow:none}.vfm-l:before{display:none}" +
    ".vfm-t td button{border:0;background:none;padding:0;font:inherit;font-weight:700;color:#17173a;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.vfm-t td button:hover{color:#9a5f00}" +
    ".vfm-miss{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.vfm-miss span{font:700 12px ui-monospace,Menlo,monospace;padding:3px 9px;border-radius:999px;background:#fbe9e7;color:#b3261e}";
  document.head.append(css);

  let busy = false;
  async function run(kind, btns) {
    const o = multiSel || cur;
    if (busy || !o || !(o.s || o.multi)) return;
    busy = true; btns.forEach((b) => (b.disabled = true));
    say("Se pregătește fișa…");
    try {
      const r = kind === "pdf" ? await asPDF(o) : kind === "docx" ? await asWord(o) : await asPNG(o);
      say(r.imagery === false ? "Fișa a fost descărcată (fără imagine satelit)." : "Fișa a fost descărcată.");
    } catch (e) {
      console.error(e); say("Nu am putut genera fișa. Verifică conexiunea și încearcă din nou.");
    } finally { busy = false; btns.forEach((b) => (b.disabled = false)); }
  }

  function addButtons() {
    const out = document.getElementById("out");
    const actions = out && out.querySelector(".actions");
    if (!actions || out.querySelector(".vfx")) return;
    const box = document.createElement("div"); box.className = "vfx";
    box.innerHTML = '<span>Descarcă fișa cu harta și datele:</span><button type="button" data-k="pdf">PDF</button><button type="button" data-k="docx">Word</button><button type="button" data-k="png">PNG</button>';
    const btns = [...box.querySelectorAll("button")];
    btns.forEach((b) => (b.onclick = () => run(b.dataset.k, btns)));
    actions.after(box);
  }
  const out = document.getElementById("out");
  if (out) new MutationObserver(addButtons).observe(out, { childList: true });
  addButtons();

  /* ---------- localizare multiplă ---------- */
  let multiSel = null, hidden = null;

  /** "405306, 405307 406991" → ["405306","405307","406991"]; null when it is a single number or a topo number. */
  function parseMany(v) {
    const t = String(v || "").split(/[\s,;]+/).filter(Boolean);
    if (t.length < 2 || !t.every((x) => /^\d+$/.test(x))) return null;
    return [...new Set(t)];
  }

  /** Back to the normal map (all parcels and buildings) when the page shows something else. */
  function leaveMulti() {
    if (!multiSel) return;
    multiSel = null;
    if (hidden) { if (hidden.all && !map.hasLayer(all)) all.addTo(map); if (hidden.bL && !map.hasLayer(bL)) bL.addTo(map); hidden = null; }
  }
  for (const fn of ["show", "showBuilding", "loadUat", "renderNear", "topoSearch", "goToPoint"]) {
    const orig = window[fn];
    if (typeof orig === "function") window[fn] = function (...a) { leaveMulti(); return orig.apply(this, a); };
  }

  function locateMany(list) {
    const out = $("out");
    if (!U) { out.innerHTML = '<div class="flag">Alege întâi localitatea (UAT) din listă sau de pe hartă. Numerele cadastrale se repetă de la o localitate la alta.</div>'; $("uatSel").focus(); return; }
    leaveMulti();
    const items = [], missing = [];
    for (const id of list) { const l = byId.get(id); if (l) items.push(...l); else missing.push(id); }
    if (!items.length) { sel.clearLayers(); out.innerHTML = '<div class="flag">Niciunul dintre numerele <b>' + esc(list.join(", ")) + "</b> nu apare în planul pentru " + esc(U.name) + ". Verifică UAT-ul ales.</div>"; return; }
    let bb = [90, 180, -90, -180];
    for (const p of items) bb = [Math.min(bb[0], p.bb[0]), Math.min(bb[1], p.bb[1]), Math.max(bb[2], p.bb[2]), Math.max(bb[3], p.bb[3])];
    multiSel = { multi: true, items, missing, bb, list };
    cur = null; lastNear = null;
    // Doar parcelele cerute pe hartă
    hidden = { all: map.hasLayer(all), bL: map.hasLayer(bL) };
    map.removeLayer(all); map.removeLayer(bL);
    sel.clearLayers(); try { locLayer.clearLayers(); } catch { /* fără strat de adresă */ }
    const polys = items.map((p) => L.polygon(p.w, { color: "#f2a93b", weight: 3, fillColor: "#f2a93b", fillOpacity: 0.3 })
      .bindTooltip(p.id, { permanent: true, direction: "center", className: "vfm-l" })
      .on("click", () => { q.value = p.id; show(p.id, p.i, true); }).addTo(sel));
    map.fitBounds(L.featureGroup(polys).getBounds(), { padding: [40, 40], maxZoom: 19, animate: false });

    const tot = items.reduce((s2, p) => s2 + p.a, 0), blds = items.reduce((s2, p) => s2 + (p.bs ? p.bs.length : 0), 0);
    let h = '<div class="idrow"><div><div class="lbl">Localizare multiplă · ' + esc(U.name) + '</div><div class="id">' + items.length + " imobile</div></div>" +
      '<span class="pill">doar cele cerute</span></div>';
    h += '<div class="facts"><div><small>Găsite</small><b>' + items.length + " din " + (items.length + missing.length) + "</b></div><div><small>Suprafață totală</small><b>" +
      nf(tot, 2) + " mp</b></div><div><small>Construcții</small><b>" + blds + "</b></div></div>";
    if (missing.length) h += '<div class="flag">Nu apar în planul pentru ' + esc(U.name) + ":<div class=\"vfm-miss\">" + missing.map((m) => "<span>" + esc(m) + "</span>").join("") + "</div></div>";
    h += '<section><h2>Imobile (' + items.length + ')</h2><div class="tw"><table class="vfm-t"><thead><tr><th>Nr. cadastral</th><th>Suprafață [mp]</th><th>Constr.</th><th>Intravilan ist.</th></tr></thead><tbody>' +
      items.map((p) => '<tr><td><button type="button" data-v="' + p.i + '">' + esc(p.id) + "</button></td><td>" + nf(p.a, 2) + "</td><td>" + (p.bs ? p.bs.length : 0) + "</td><td>" + (p.iv ? "da" : "nu") + "</td></tr>").join("") +
      '</tbody><tfoot><tr><td colspan="4" style="text-align:left">Total S = ' + nf(tot, 2) + " mp</td></tr></tfoot></table></div>" +
      '<p class="hint" style="margin-top:8px">Atinge un număr ca să vezi parcela, coordonatele și vecinii.</p></section>';
    h += '<div class="actions"><button type="button" class="btn2" id="vfmCopy">Copiază tabelul</button><button type="button" class="btn2" id="vfmKml">Descarcă KML</button>' +
      '<button type="button" class="btn2" id="vfmAll">Arată tot planul</button></div>';
    out.innerHTML = h;
    out.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { const p = P[+b.dataset.v]; q.value = p.id; show(p.id, p.i, true); }));
    $("vfmAll").onclick = (e) => {
      const showing = map.hasLayer(all);
      if (showing) { map.removeLayer(all); map.removeLayer(bL); } else { all.addTo(map); bL.addTo(map); }
      e.target.textContent = showing ? "Arată tot planul" : "Doar parcelele cerute";
      sel.eachLayer((l) => l.bringToFront && l.bringToFront());
    };
    $("vfmCopy").onclick = () => {
      const rows = ["Nr. cadastral\tSuprafață [mp]\tPerimetru [m]\tConstrucții\tIntravilan istoric\tLatitudine\tLongitudine"]
        .concat(items.map((p) => [p.id, p.a.toFixed(2), geom(p).per.toFixed(2), p.bs ? p.bs.length : 0, p.iv ? "da" : "nu", p.c[0].toFixed(7), p.c[1].toFixed(7)].join("\t")));
      if (missing.length) rows.push("Negăsite: " + missing.join(", "));
      const txt = rows.join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => say("Tabel copiat. Lipește-l în Excel sau Word."), () => say("Copierea nu e permisă în acest browser"));
    };
    $("vfmKml").onclick = () => {
      const pm = items.map((p) => "<Placemark><name>" + esc(p.id) + "</name><description>" + esc(nf(p.a, 2) + " mp · " + U.name) + "</description><styleUrl>#p</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>" +
        p.w.concat([p.w[0]]).map((w) => w[1] + "," + w[0] + ",0").join(" ") + "</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>").join("");
      const doc = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Localizare multiplă · ' + esc(U.name) +
        '</name><Style id="p"><LineStyle><color>ff3ba9f2</color><width>3</width></LineStyle><PolyStyle><color>553ba9f2</color></PolyStyle></Style>' + pm + "</Document></kml>";
      save(new Blob([doc], { type: "application/vnd.google-earth.kml+xml" }), `Localizare_multipla_${items.length}_imobile_${U.key}.kml`);
    };
    history.replaceState(null, "", "#" + U.key + "-" + list.join(","));
    try { scrollToMap(); } catch { /* desktop */ }
  }

  // Căutarea: mai multe numere cadastrale → localizare multiplă; un singur număr merge ca înainte.
  document.addEventListener("submit", (e) => {
    if (!e.target || e.target.id !== "f" || (typeof searchMode !== "undefined" && searchMode !== "cad")) return;
    const many = parseMany(q.value);
    if (!many) return;
    e.preventDefault(); e.stopImmediatePropagation();
    q.blur(); const sg = document.getElementById("sugg"); if (sg) sg.innerHTML = "";
    locateMany(many);
  }, true);
  q.addEventListener("input", () => { if (parseMany(q.value) || /[,;]\s*$/.test(q.value)) { const sg = document.getElementById("sugg"); if (sg) sg.innerHTML = ""; } });
  q.placeholder = "ex. 405306 sau mai multe: 405306, 405307";

  // Link direct: #giroc-406991,405306
  (async () => {
    const m = decodeURIComponent(location.hash.slice(1)).match(/^([a-z-]+?)-(\d+(?:,\d+)+)$/);
    if (!m || !UATS.some((u) => u.key === m[1])) return;
    await loadUat(m[1]);
    q.value = m[2].split(",").join(", ");
    locateMany(parseMany(m[2]));
  })();
})();
