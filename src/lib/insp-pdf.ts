// The inspection sheet as a real PDF file (not the browser's print dialog), laid out like the VALUEFY sheet the user showed
// (10 nov 2026): the firm's brand on top, the cover photo, four cards, the property's data, the location on a small map
// (OpenStreetMap tiles), the answers by group with the value on the right, the rooms, the findings, the signatures, then
// "Documentar foto": one photo a row, numbered. A4, Plus Jakarta Sans, built in the worker with pdf-lib. The same generator
// serves /api/inspectii/pdf/<id> (everything) and /api/fisa/<token>/pdf (the public sheet: no contact person, documents,
// location or signatures, and no questions about people).
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, pushGraphicsState, popGraphicsState, clip, endPath, moveTo, lineTo, appendBezierCurve, closePath, type PDFOperator } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Insp } from "./insp";
import { compSummary, coverPhoto, fmtWhen, photoCategories } from "./insp-shared";

/**
 * The firm behind the inspection. Its brand (logo, name, authorisation) heads the sheet only when the firm has the office
 * function (`orgs.office_at`, where the logo is uploaded — the premium plan later); otherwise the valuer's name and card.
 */
export type PdfFirm = { name: string; corp_no: string | null; logo: string | null; office_at: string | null } | null;
export type PdfOpts = {
  firm: PdfFirm;
  /** the public sheet (share link): the firm's brand only, nothing about people */
  pub: boolean;
  /** the app's origin, where the fonts are served from (/fonts/pjs-*.ttf) */
  origin: string;
  /** the bytes of a file of the inspection (photo, signature), or null when it is gone */
  file: (id: string) => Promise<Uint8Array | null>;
};

/* ---------- page geometry and colours ---------- */
const W = 595.28, H = 841.89, M = 44, CW = W - 2 * M, BOTTOM = 50;
type Col = ReturnType<typeof rgb>;
const DARK = rgb(0.078, 0.078, 0.078), GOLD = rgb(0.878, 0.678, 0.31), GOLD_DK = rgb(0.604, 0.373, 0), MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.886, 0.847, 0.769), CREAM = rgb(0.984, 0.973, 0.949), WHITE = rgb(1, 1, 1), BLUE = rgb(0.149, 0.388, 0.922), GREY = rgb(0.93, 0.93, 0.93);
const TZ = "Europe/Bucharest";
const nf = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toLocaleString("ro-RO", { maximumFractionDigits: d }));
const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleString("ro-RO", withTime ? { dateStyle: "short", timeStyle: "short", timeZone: TZ } : { dateStyle: "medium", timeZone: TZ }) : "—";
const ans = (v: string | string[] | undefined, unit?: string) => (Array.isArray(v) ? (v.length ? v.join(", ") : "") : v ? `${v}${unit ? ` ${unit}` : ""}` : "");
// questions about people (who was present, the owner, phone, e-mail) stay off the public sheet
const PRIVATE_Q = /prezent|persoan|contact|telefon|proprietar|chiria|e-?mail|\bnume\b|cnp|semn/i;

/* ---------- fonts: Plus Jakarta Sans, static instances (regular 400, bold 700) with the Romanian letters ---------- */
let fontCache: Promise<{ r: Uint8Array; b: Uint8Array }> | null = null;
function fontBytes(origin: string) {
  fontCache ??= (async () => {
    const get = async (name: string) => {
      const url = `${origin}/fonts/${name}`;
      let res: Response | null = null;
      try {
        const { env } = await getCloudflareContext({ async: true });
        const assets = (env as { ASSETS?: { fetch: (r: Request) => Promise<Response> } }).ASSETS;
        if (assets) res = await assets.fetch(new Request(url));
      } catch { /* outside the worker (next dev): the plain fetch below */ }
      if (!res?.ok) res = await fetch(url);
      if (!res.ok) throw new Error(`Fontul ${name} nu s-a putut încărca (${res.status}).`);
      return new Uint8Array(await res.arrayBuffer());
    };
    const [r, b] = await Promise.all([get("pjs-400.ttf"), get("pjs-700.ttf")]);
    return { r, b };
  })().catch((e) => { fontCache = null; throw e; });
  return fontCache;
}

/** the operators of a rounded rectangle path (for clipping) */
function roundPath(x: number, y: number, w: number, h: number, r: number): PDFOperator[] {
  const k = 0.5523 * r;
  return [
    moveTo(x + r, y),
    lineTo(x + w - r, y), appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r),
    lineTo(x + w, y + h - r), appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
    lineTo(x + r, y + h), appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
    lineTo(x, y + r), appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y),
    closePath(),
  ];
}
/** an SVG path for the same rectangle (drawSvgPath: the border / the fill), relative to its top-left corner */
const roundSvg = (w: number, h: number, r: number) => `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;

/* ---------- the page writer: cursor, wrapping, page breaks ---------- */
type Style = { f?: PDFFont; size?: number; color?: Col; lh?: number };
class Doc {
  pdf!: PDFDocument; fr!: PDFFont; fb!: PDFFont; ok!: (s: string) => string;
  pages: PDFPage[] = []; page!: PDFPage; y = 0;
  /** draws a page's header, returns how much of the top it took */
  head: (d: Doc, first: boolean) => number = () => 56;

  newPage() {
    this.page = this.pdf.addPage([W, H]);
    this.pages.push(this.page);
    this.y = H - this.head(this, this.pages.length === 1);
  }
  /** room for h points, else a new page */
  ensure(h: number) { if (this.y - h < BOTTOM) this.newPage(); }
  gap(h: number) { this.y -= h; }
  w(s: string, f: PDFFont, size: number) { return f.widthOfTextAtSize(this.ok(s), size); }

  /** the lines of a text at a width (words, then letters for words longer than the line); "\n" starts a new line */
  wrap(text: string, f: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of this.ok(text).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(""); continue; }
      let line = "";
      for (const word of words) {
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) <= width) { line = t; continue; }
        if (line) out.push(line);
        if (f.widthOfTextAtSize(word, size) <= width) { line = word; continue; }
        let part = "";
        for (const ch of word) {
          if (f.widthOfTextAtSize(part + ch, size) > width && part) { out.push(part); part = ""; }
          part += ch;
        }
        line = part;
      }
      out.push(line);
    }
    return out;
  }
  /** one line at x, y (the baseline); cut with "…" at maxW; aligned right / centre on maxW; letter-spaced for eyebrows */
  text(s: string, x: number, y: number, st: Style & { maxW?: number; align?: "left" | "right" | "center"; spacing?: number } = {}) {
    const f = st.f ?? this.fr, size = st.size ?? 10;
    let t = this.ok(s).replace(/\s*\n\s*/g, " ");
    const width = (v: string) => f.widthOfTextAtSize(v, size) + (st.spacing ? st.spacing * Math.max(0, v.length - 1) : 0);
    if (st.maxW != null && width(t) > st.maxW) {
      while (t.length && width(`${t}…`) > st.maxW) t = t.slice(0, -1);
      t = `${t.trimEnd()}…`;
    }
    const tw = width(t);
    const dx = st.align === "right" && st.maxW != null ? st.maxW - tw : st.align === "center" && st.maxW != null ? (st.maxW - tw) / 2 : 0;
    if (st.spacing) {
      let cx = x + dx;
      for (const ch of t) { this.page.drawText(ch, { x: cx, y, size, font: f, color: st.color ?? DARK }); cx += f.widthOfTextAtSize(ch, size) + st.spacing; }
    } else this.page.drawText(t, { x: x + dx, y, size, font: f, color: st.color ?? DARK });
    return tw;
  }
  /** a small spaced label in capitals ("SUPRAFAȚĂ UTILĂ") */
  eyebrow(s: string, x: number, y: number, color: Col = MUTED, maxW = CW, size = 6.8) {
    this.text(this.ok(s).toLocaleUpperCase("ro"), x, y, { f: this.fb, size, color, maxW, spacing: 0.9 });
  }
  /** a paragraph from the cursor down, breaking pages between lines */
  para(s: string, x: number, width: number, st: Style & { align?: "left" | "right" } = {}) {
    const f = st.f ?? this.fr, size = st.size ?? 10, lh = st.lh ?? size * 1.4;
    for (const line of this.wrap(s, f, size, width)) {
      this.ensure(lh);
      this.y -= lh;
      if (line) this.text(line, x, this.y + (lh - size) / 2 + size * 0.18, { f, size, color: st.color, maxW: width, align: st.align });
    }
  }
  line(x1: number, x2: number, y: number, color: Col = LINE, thickness = 0.6) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }
  rect(x: number, y: number, w: number, h: number, fill?: Col, border?: Col) {
    this.page.drawRectangle({ x, y, width: w, height: h, ...(fill ? { color: fill } : {}), ...(border ? { borderColor: border, borderWidth: 0.7 } : {}) });
  }
  /** a rounded box (fill and / or border) */
  box(x: number, y: number, w: number, h: number, r: number, fill?: Col, border?: Col) {
    this.page.drawSvgPath(roundSvg(w, h, r), { x, y: y + h, ...(fill ? { color: fill } : {}), ...(border ? { borderColor: border, borderWidth: 0.8 } : {}) });
  }
  /** an image filling a rounded box (cropped, like object-fit: cover) */
  cover(img: PDFImage, x: number, y: number, w: number, h: number, r = 8) {
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    this.page.pushOperators(pushGraphicsState(), ...roundPath(x, y, w, h, r), clip(), endPath());
    this.page.drawImage(img, { x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh });
    this.page.pushOperators(popGraphicsState());
  }
  /** an image inside a box, whole, centred (object-fit: contain) */
  contain(img: PDFImage, x: number, y: number, w: number, h: number) {
    const s = Math.min(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    this.page.drawImage(img, { x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh });
  }

  /** a numbered section title ("01  Amplasament și zonă") with its rule under */
  h2(no: string, title: string) {
    this.ensure(48);
    this.y -= 26;
    this.text(no, M, this.y, { f: this.fb, size: 8.5, color: GOLD_DK });
    this.text(title, M + 20, this.y - 1, { f: this.fb, size: 12.5, maxW: CW - 20 });
    this.y -= 9;
    this.line(M, W - M, this.y, DARK, 0.8);
    this.y -= 4;
  }
  /** label (left, muted) / value (right, bold) rows with thin separators, as on the sheet */
  rows(list: [string, string][]) {
    const size = 9.2, lh = 12.6, lw = Math.round(CW * 0.4), vw = CW - lw - 12;
    for (const [k, v] of list) {
      const kl = this.wrap(k, this.fr, size, lw), vl = this.wrap(v || "—", this.fb, size, vw);
      const n = Math.max(kl.length, vl.length), h = n * lh + 9;
      this.ensure(Math.min(h, H - BOTTOM - 90));
      const top = this.y;
      kl.forEach((l, i) => this.text(l, M, top - 5 - (i + 1) * lh + lh * 0.3, { size, color: MUTED }));
      vl.forEach((l, i) => this.text(l, M + lw + 12, top - 5 - (i + 1) * lh + lh * 0.3, { f: this.fb, size, maxW: vw, align: "right" }));
      this.y = top - h;
      this.line(M, W - M, this.y + 1);
    }
  }
  /** label above value, in a grid of columns (the property's data on the first page) */
  grid(list: [string, string][], cols = 2) {
    const gapX = 16, cw = (CW - gapX * (cols - 1)) / cols, size = 9.4, lh = 12.4;
    for (let i = 0; i < list.length; i += cols) {
      const cells = list.slice(i, i + cols).map(([, v]) => this.wrap(v || "—", this.fb, size, cw));
      const h = 11 + Math.max(...cells.map((c) => c.length)) * lh + 6;
      this.ensure(h);
      const top = this.y;
      list.slice(i, i + cols).forEach(([k], j) => {
        const x = M + j * (cw + gapX);
        this.text(k, x, top - 9, { size: 7.6, color: MUTED, maxW: cw });
        cells[j].forEach((l, r) => this.text(l, x, top - 11 - (r + 1) * lh + lh * 0.3, { f: this.fb, size, maxW: cw }));
      });
      this.y = top - h;
    }
  }
  /** a small table with a header row; column widths as fractions of the content width */
  table(head: string[], body: string[][], cols: number[], opts: { bold?: number[]; right?: number[]; total?: string[] } = {}) {
    const size = 9, lh = 12.5, xs: number[] = []; let x = M;
    for (const c of cols) { xs.push(x); x += c * CW; }
    const cellW = (i: number) => cols[i] * CW - 6;
    const row = (cells: string[], bold: boolean, bg?: Col, muted = false) => {
      const isB = (i: number) => bold || !!opts.bold?.includes(i);
      const lines = cells.map((c, i) => this.wrap(c, isB(i) ? this.fb : this.fr, size, cellW(i)));
      const h = Math.max(1, ...lines.map((l) => l.length)) * lh + 6;
      this.ensure(h);
      if (bg) this.rect(M, this.y - h, CW, h, bg);
      lines.forEach((ls, i) => ls.forEach((l, j) => this.text(l, xs[i] + 3, this.y - 4 - (j + 1) * lh + lh * 0.3,
        { f: isB(i) ? this.fb : this.fr, size, color: muted ? MUTED : DARK, maxW: cellW(i), align: opts.right?.includes(i) ? "right" : "left" })));
      this.y -= h;
      this.line(M, W - M, this.y);
    };
    row(head, true, CREAM, true);
    for (const b of body) row(b, false);
    if (opts.total) row(opts.total, true);
  }
}

/* ---------- images ---------- */
function fromDataUrl(s: string | null | undefined): Uint8Array | null {
  const m = s?.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  try { return m ? Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0)) : null; } catch { return null; }
}
async function embed(pdf: PDFDocument, bytes: Uint8Array | null): Promise<PDFImage | null> {
  if (!bytes || bytes.length < 8) return null;
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes);
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
  } catch { /* a broken file: left out */ }
  return null; // WebP, HEIC…: not embeddable here
}
/** N at a time */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/* ---------- the location on OpenStreetMap tiles (zoom 16, clipped to a rounded box) ---------- */
async function drawMap(d: Doc, x: number, y: number, w: number, h: number, lat: number, lng: number, acc: number | null, addr: [number, number] | null) {
  const z = 16, n = 2 ** z, T = 256;
  const px = (ln: number) => ((ln + 180) / 360) * n * T;
  const py = (la: number) => { const r = (la * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * T; };
  const cx = px(lng), cy = py(lat);
  const ts = w / 2.4;                     // a tile's size on paper: about 2.4 tiles across the box
  const k = ts / T;                       // paper points per tile pixel
  const left = cx - w / 2 / k, top = cy - h / 2 / k;
  const tx0 = Math.floor(left / T), tx1 = Math.floor((left + w / k) / T), ty0 = Math.floor(top / T), ty1 = Math.floor((top + h / k) / T);
  const tiles: [number, number][] = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) tiles.push([tx, ty]);
  if (tiles.length > 12) return false;
  const imgs = await pool(tiles, 6, async ([tx, ty]) => {
    try {
      const res = await fetch(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`, { headers: { "User-Agent": "UVALO/1.0 (+https://app.uvalo.ro)" } });
      return res.ok ? await embed(d.pdf, new Uint8Array(await res.arrayBuffer())) : null;
    } catch { return null; }
  });
  if (!imgs.some(Boolean)) return false;
  d.page.pushOperators(pushGraphicsState(), ...roundPath(x, y, w, h, 8), clip(), endPath());
  d.rect(x, y, w, h, CREAM);
  tiles.forEach(([tx, ty], i) => { const img = imgs[i]; if (img) d.page.drawImage(img, { x: x + (tx * T - left) * k, y: y + h - (ty * T - top) * k - ts, width: ts, height: ts }); });
  const at = (la: number, ln: number) => ({ x: x + (px(ln) - left) * k, y: y + h - (py(la) - top) * k });
  const c = at(lat, lng);
  if (acc && acc > 5) {
    const mpp = (156543.03 * Math.cos((lat * Math.PI) / 180)) / n;   // metres per tile pixel at this zoom
    d.page.drawCircle({ x: c.x, y: c.y, size: (acc / mpp) * k, borderColor: BLUE, borderWidth: 1, color: BLUE, opacity: 0.08, borderOpacity: 0.8 });
  }
  if (addr) { const a = at(addr[0], addr[1]); d.page.drawCircle({ x: a.x, y: a.y, size: 4.5, color: rgb(0.54, 0.48, 0.35), borderColor: WHITE, borderWidth: 1.5 }); }
  // the pin: a gold drop with a dark dot
  d.page.drawSvgPath("M 0 0 C -7 -9 -11 -13 -11 -19 A 11 11 0 1 1 11 -19 C 11 -13 7 -9 0 0 Z", { x: c.x, y: c.y, color: GOLD, borderColor: DARK, borderWidth: 1.2 });
  d.page.drawCircle({ x: c.x, y: c.y + 19, size: 3.6, color: DARK });
  d.page.pushOperators(popGraphicsState());
  d.text("© OpenStreetMap", x + w - 6, y + 5, { size: 6.5, color: MUTED, maxW: 80, align: "right" });
  return true;
}

/* ---------- the document ---------- */
export async function sheetPdf(x: Insp, o: PdfOpts): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fb = await fontBytes(o.origin);
  const d = new Doc();
  d.pdf = pdf;
  [d.fr, d.fb] = await Promise.all([pdf.embedFont(fb.r, { subset: true }), pdf.embedFont(fb.b, { subset: true })]);
  // the letters the font has; anything else (emoji, arrows) is dropped rather than drawn as a box
  const fk = fontkit.create(fb.r);
  const has = new Map<number, boolean>();
  d.ok = (s: string) => Array.from(String(s ?? "")).map((ch) => {
    const cp = ch.codePointAt(0)!;
    if (ch === "\n") return ch;
    if (cp < 32) return " ";
    let h = has.get(cp); if (h == null) { h = fk.hasGlyphForCodePoint(cp); has.set(cp, h); }
    return h ? ch : "";
  }).join("");

  const pub = o.pub, firm = o.firm?.office_at ? o.firm : null;
  const sheetNo = x.sheet_no ?? null, sheetAt = x.sheet_at ?? null;
  const code = sheetNo ?? x.code;
  const shown = ["gata", "pred", "lucru"].includes(x.status);
  const photos = x.files.filter((f) => f.kind === "photo"), docs = x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature");
  const sigFile = x.files.filter((f) => f.kind === "signature").at(-1) ?? null;
  const cover = coverPhoto(x.files, x.cover_file_id);
  const rooms = x.room_answers.length ? x.room_answers : x.rooms;
  const util = rooms.reduce((s, r) => s + (r.a ?? 0), 0);
  const fin = !!x.template.rooms || x.room_answers.some((r) => (r as { floor?: string }).floor);
  const ownFind = x.template.groups.some((g) => g.id === "constatari");
  // the groups and their rows: the full sheet keeps every question (the record of the property); the public one only the
  // answered, non-personal ones
  const groups = x.template.groups.map((g) => ({
    id: g.id, name: g.name,
    rows: g.qs.filter((q) => q.pdf !== false && (!pub || !PRIVATE_Q.test(q.t)))
      .map((q) => [q.t, shown ? (q.kind === "comp" ? compSummary(q, x.answers) || "" : ans(x.answers[q.id], q.unit)) : ""] as [string, string])
      .filter(([, v]) => !pub || v),
  })).filter((g) => g.rows.length);
  const title = x.prop_type ?? "Imobil";
  const dateLine = x.finished_at ? fmtDate(x.finished_at) : x.scheduled_at ? fmtWhen(x.scheduled_at) : "";
  // the brand line: the office's name, else the valuer (with the ANEVAR card under it)
  const firmLine = firm?.name ?? x.assignee_name ?? x.owner_name;
  const brandSub = firm ? (firm.corp_no ? `Autorizație ANEVAR nr. ${firm.corp_no}` : "") : `Evaluator${x.assignee_legit ? ` · leg. ANEVAR ${x.assignee_legit}` : ""}`;

  /* images: the logo, the cover, the photos, the signatures (fetched 6 at a time) */
  const logo = firm?.logo ? await embed(pdf, fromDataUrl(firm.logo)) : null;
  const wanted = [...photos.map((p) => p.id), ...(!pub && sigFile && x.signed_at ? [sigFile.id] : [])];
  const bytes = await pool(wanted, 6, (id) => o.file(id).catch(() => null));
  const img = new Map<string, PDFImage>();
  for (let i = 0; i < wanted.length; i++) { const im = await embed(pdf, bytes[i]); if (im) img.set(wanted[i], im); }
  const valuerSig = !pub && x.finished_at && x.assignee_sig ? await embed(pdf, fromDataUrl(x.assignee_sig)) : null;

  /** the brand block: the logo (with the office function), a bold line and small lines under it; right: what the document is, in gold capitals */
  const brand = (dd: Doc, title: string, lines: string[], right: [string, string, string]) => {
    const top = H - M;
    let hx = M;
    if (logo) { const s = Math.min(130 / logo.width, 36 / logo.height); dd.page.drawImage(logo, { x: M, y: top - 36 + (36 - logo.height * s) / 2, width: logo.width * s, height: logo.height * s }); hx = M + logo.width * s + 14; }
    dd.text(title, hx, top - 13, { f: dd.fb, size: 10.5, maxW: 290 });
    lines.filter(Boolean).forEach((l, i) => dd.text(l, hx, top - 25 - i * 11, { size: 7.8, color: MUTED, maxW: 290 }));
    const rt = (s: string, y: number, color: Col) => { const t = dd.ok(s).toLocaleUpperCase("ro"); const w = dd.fb.widthOfTextAtSize(t, 7.6) + 0.9 * (t.length - 1); dd.text(t, W - M - w, y, { f: dd.fb, size: 7.6, color, spacing: 0.9 }); };
    if (right[0]) rt(right[0], top - 10, DARK);
    if (right[1]) rt(right[1], top - 23, GOLD_DK);
    if (right[2]) rt(right[2], top - 35, GOLD_DK);
    dd.line(M, W - M, top - 48, DARK, 0.8);
    return M + 60;
  };

  /* the running header: the brand on the first page and on the first photo page, a thin line with the firm and the sheet elsewhere */
  let photoHead = false;
  d.head = (dd, first) => {
    if (first) return brand(dd, firmLine, [brandSub], ["Fișă de inspecție", code, sheetAt ? fmtDate(sheetAt) : ""]);
    if (photoHead) {
      photoHead = false;
      return brand(dd, "Documentar foto", [firm ? x.address : `${firmLine} · ${x.address}`], ["", `${photos.length} ${photos.length === 1 ? "fotografie" : "fotografii"}`, ""]);
    }
    dd.text(firmLine, M, H - 30, { f: dd.fb, size: 7.8, color: MUTED, maxW: 200 });
    dd.text(`Fișă de inspecție ${code} · ${x.address}`, M + 210, H - 30, { size: 7.8, color: MUTED, maxW: CW - 210, align: "right" });
    dd.line(M, W - M, H - 38);
    return 54;
  };
  d.newPage();

  /* ---------- page 1: the cover, the title, four cards, the property's data ---------- */
  const coverImg = cover ? img.get(cover.id) : null;
  if (coverImg) { d.y -= 212; d.cover(coverImg, M, d.y, CW, 212, 10); d.y -= 20; }
  else d.y -= 6;
  d.eyebrow(`Fișă de inspecție${sheetNo ? ` nr. ${sheetNo}${sheetAt ? ` din ${fmtDate(sheetAt)}` : ""}` : ` ${x.code}`}`, M, d.y - 6, GOLD_DK, CW, 7.4);
  d.y -= 16;
  d.para(title, M, CW, { f: d.fb, size: 19, lh: 24 });
  d.y -= 4;
  d.para([x.address, x.cad_nr && `nr. cad. ${x.cad_nr}`, x.cf_nr && `CF ${x.cf_nr}`].filter(Boolean).join(" · "), M, CW, { size: 10.5, color: MUTED, lh: 14.5 });
  d.y -= 12;
  // four cards, two a row
  const cards: [string, string, string, boolean][] = pub ? [
    ["Suprafață utilă", util ? `${nf(util)} m²` : x.area_util ? `${nf(x.area_util)} m²` : "—", x.area_util ? (util ? `acte ${nf(x.area_util)} m²` : "din acte") : "din releveu", false],
    ["Teren", x.area_land ? `${nf(x.area_land, 0)} m²` : "—", "din acte", false],
    ["Inspecția", dateLine || "—", x.finished_at ? fmtDate(x.finished_at, true).split(", ")[1] ?? "" : "programare", false],
    ["Încăperi", rooms.length ? String(rooms.length) : "—", rooms.length ? "din releveu" : "", true],
  ] : [
    ["Suprafață utilă", util ? `${nf(util)} m²` : x.area_util ? `${nf(x.area_util)} m²` : "—", x.area_util ? (util ? `acte ${nf(x.area_util)} m²` : "din acte") : "din releveu", false],
    ["Teren", x.area_land ? `${nf(x.area_land, 0)} m²` : "—", "din acte", false],
    ["Inspecția", dateLine || "—", x.started_at && x.finished_at ? `${fmtDate(x.started_at, true).split(", ")[1] ?? ""} – ${fmtDate(x.finished_at, true).split(", ")[1] ?? ""}` : x.finished_at ? fmtDate(x.finished_at, true).split(", ")[1] ?? "" : "programare", false],
    ["Făcută de", x.assignee_name ?? "de ales", x.assignee_legit ? `leg. ANEVAR ${x.assignee_legit}` : `pentru ${x.owner_name}`, true],
  ];
  const cw2 = (CW - 12) / 2, ch2 = 56;
  for (let i = 0; i < cards.length; i += 2) {
    d.ensure(ch2 + 10);
    d.y -= ch2;
    cards.slice(i, i + 2).forEach(([k, v, sub, dark], j) => {
      const kx = M + j * (cw2 + 12);
      d.box(kx, d.y, cw2, ch2, 8, dark ? DARK : WHITE, dark ? undefined : LINE);
      d.eyebrow(k, kx + 12, d.y + ch2 - 15, dark ? GOLD : MUTED, cw2 - 24);
      d.text(v, kx + 12, d.y + ch2 - 33, { f: d.fb, size: 13.5, color: dark ? WHITE : DARK, maxW: cw2 - 24 });
      d.text(sub, kx + 12, d.y + 10, { size: 7.8, color: dark ? rgb(0.78, 0.78, 0.78) : MUTED, maxW: cw2 - 24 });
    });
    d.y -= 10;
  }
  d.y -= 4;
  // the property's data, two columns
  const meta: [string, string][] = ((pub ? [
    ["Nr. cadastral", x.cad_nr ?? ""], ["Carte funciară", x.cf_nr ?? ""], ["Localitate", [x.uat, x.county].filter(Boolean).join(", ")],
    ["Suprafață din acte", x.area_util ? `${nf(x.area_util)} m²` : ""], ["Evaluator", x.assignee_name ?? ""],
  ] : [
    ...(x.ext_client ? [["Client", x.ext_client] as [string, string]] : []), ...(x.ext_user ? [["Utilizatorul raportului", x.ext_user] as [string, string]] : []),
    ["Persoana de contact", [x.contact_name, x.contact_role].filter(Boolean).join(", ")], ["Telefon", x.contact_phone ?? ""],
    ["Localitate", [x.uat, x.county].filter(Boolean).join(", ")], ["Persoana prezentă", x.signed_name ?? ""],
    ["Fișa", `${x.template_name ?? "—"}${x.template_version ? ` · v${x.template_version}` : ""}`],
    ["Nr. și data fișei", sheetNo ? `${sheetNo} · ${fmtDate(sheetAt, true)}` : "se dau când începe completarea"],
    ["Pregătită de", `${x.owner_name}${x.org_name ? ` (${x.org_name})` : ""}`], ["Pregătită la", fmtDate(x.created_at, true)],
    ...(x.facts ?? []).map((f) => [f.label, f.value] as [string, string]),
  ]) as [string, string][]).filter(([, v]) => v);
  d.grid(meta);
  if (!shown && !pub) {
    d.gap(6);
    d.para(x.status === "lucru" ? "Fișa e în lucru pe telefon: răspunsurile de mai jos sunt cele trimise până acum." : `Inspecția nu a fost făcută încă${x.scheduled_at ? `: e programată pentru ${fmtWhen(x.scheduled_at)}` : ""}. Fișa se completează pe telefon.`, M, CW, { size: 9, color: MUTED });
  }

  /* ---------- page 2: the location (the phone's GPS, else the address pin), then the answers ---------- */
  if (!pub) {
    const gps = x.gps_lat != null && x.gps_lng != null;
    const la = gps ? x.gps_lat! : x.lat, ln = gps ? x.gps_lng! : x.lng;
    if (la != null && ln != null) {
      d.newPage();
      const addr: [number, number] | null = gps && x.lat != null && x.lng != null ? [x.lat, x.lng] : null;
      const dAddr = addr ? Math.round(Math.hypot((la - addr[0]) * 111320, (ln - addr[1]) * 111320 * Math.cos((la * Math.PI) / 180))) : null;
      const mh = 150;
      d.y -= mh;
      const drawn = await drawMap(d, M, d.y, CW, mh, la, ln, gps ? x.gps_acc ?? null : null, addr && dAddr != null && dAddr < 400 ? addr : null);
      if (!drawn) { d.box(M, d.y, CW, mh, 8, CREAM, LINE); d.text("Harta nu a putut fi încărcată", M, d.y + mh / 2, { size: 9, color: MUTED, maxW: CW, align: "center" }); }
      d.y -= 8;
      const facts: [string, string][] = [
        ["Coordonate GPS", `${la.toFixed(6)}, ${ln.toFixed(6)}`],
        ["Sursa", gps ? (x.gps_src === "manual" ? "Pinul mutat manual pe hartă, pe telefon" : `GPS-ul telefonului${x.gps_acc ? ` · precizie ±${Math.round(x.gps_acc)} m` : ""}${x.gps_at ? ` · ${fmtDate(x.gps_at, true)}` : ""}`) : "Pinul proprietății, din adresă / cadastru (fișa nu are GPS)"],
        ...(dAddr != null ? [["Față de adresă", dAddr < 15 ? "pe adresa din pregătire" : `la ${dAddr} m de adresa din pregătire`] as [string, string]] : []),
      ];
      for (const [k, v] of facts) {
        d.ensure(26);
        d.y -= 14;
        d.eyebrow(k, M, d.y);
        d.y -= 2;
        d.para(v, M, CW, { size: 9.2, lh: 12 });
      }
      d.y -= 2;
    }
  }

  /* ---------- the answers, by group ---------- */
  let no = 0;
  const num = () => String(++no).padStart(2, "0");
  if (shown || !pub) for (const g of groups) { d.h2(num(), g.name); d.rows(g.rows.map(([k, v]) => [k, v || "—"])); }

  /* ---------- the rooms ---------- */
  if (rooms.length) {
    d.h2(num(), fin ? "Încăperi și finisaje" : "Încăperi");
    const head = ["Poz.", "Încăpere", "m²", ...(fin ? ["Pardoseală", "Pereți", "Plafon", "Stare"] : [])];
    const cols = fin ? [0.07, 0.25, 0.1, 0.15, 0.15, 0.14, 0.14] : [0.1, 0.6, 0.3];
    const body = rooms.map((r, i) => { const ra = r as { floor?: string; walls?: string; ceiling?: string; state?: string }; return [String(i + 1), r.n, r.a ? nf(r.a) : "—", ...(fin ? [ra.floor ?? "—", ra.walls ?? "—", ra.ceiling ?? "—", ra.state ?? "—"] : [])]; });
    const diff = x.area_util ? `acte: ${nf(x.area_util)} m² · diferență ${util - x.area_util >= 0 ? "+" : ""}${nf(util - x.area_util)} m²` : "";
    d.table(head, body, cols, { bold: [1], right: [2], total: ["", "Suprafață utilă", nf(util), ...(fin ? [diff, "", "", ""] : [diff])] });
  }

  /* ---------- the free findings (older sheets) ---------- */
  const f = x.findings ?? {};
  if (!ownFind && (!pub || (shown && (f.diff || f.defects || f.notes)))) {
    d.h2(num(), "Constatări");
    d.rows(([["Diferențe față de acte", f.diff], ["Defecte vizibile", f.defects], ["Observații", f.notes || (pub ? "" : x.notes)]] as [string, string | undefined][])
      .filter(([, v]) => !pub || v).map(([k, v]) => [k, v || "—"]));
  }

  if (!pub) {
    /* ---------- the documents ---------- */
    if (docs.length) {
      d.h2(num(), `Acte (${docs.length})`);
      d.rows(docs.map((dd): [string, string] => [dd.kind === "cf" ? "Extras de carte funciară" : dd.kind === "releveu" ? "Releveu" : "Document", dd.name ?? dd.kind]));
    }

    /* ---------- the signatures: the person present, then the valuer ---------- */
    const sigNo = num();
    const sign = (who: string, name: string, sub: string, im: PDFImage | null | undefined, note: string, first: boolean) => {
      const h = 100;
      d.ensure(h);
      d.y -= 24;
      d.eyebrow(first ? `${sigNo} · ${who}` : who, M, d.y, GOLD_DK);
      d.y -= 14;
      d.text(name, M, d.y, { f: d.fb, size: 10.5, maxW: CW - 120 });
      if (sub) d.text(sub, M + d.w(name, d.fb, 10.5) + 5, d.y, { size: 8.5, color: MUTED, maxW: 200 });
      d.y -= 50;
      if (im) d.contain(im, M, d.y + 2, 150, 44);
      d.line(M, W - M, d.y, LINE, 0.8);
      d.y -= 11;
      d.text(note, M, d.y, { size: 7.8, color: MUTED, maxW: CW });
    };
    const sigImg = sigFile && x.signed_at ? img.get(sigFile.id) : null;
    d.ensure(210); // both signatures on the same page
    sign("Persoana prezentă", x.signed_name ?? "—", "", sigImg, x.signed_at ? `Semnat pe telefon · ${fmtDate(x.signed_at, true)}` : "Semnătura se ia pe telefon, la finalizarea fișei", true);
    sign("Evaluator", x.assignee_name ?? "—", x.assignee_legit ? `· leg. ${x.assignee_legit}` : "", valuerSig,
      x.finished_at && x.assignee_sig ? "Semnătura evaluatorului · din contul lui, aplicată la finalizare" : x.assignee_sig ? "Semnătura evaluatorului se aplică automat la finalizare" : "Semnătura evaluatorului", false);
  }

  /* ---------- "Documentar foto": one photo a row, numbered, by category ---------- */
  if (photos.length) {
    photoHead = true;
    d.newPage();
    d.h2(num(), "Fotografii");
    d.y -= 4;
    const pc = photoCategories(x.prop_type, x.template.photos), order = [...pc.before, ...pc.after];
    const sorted = [...photos].sort((a, b) => {
      const ia = order.indexOf(a.room ?? ""), ib = order.indexOf(b.room ?? "");
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || (a.taken_at ?? "").localeCompare(b.taken_at ?? "");
    });
    const ph = 168, cap = 16, cell = ph + cap + 12;
    sorted.forEach((p, i) => {
      d.ensure(cell);
      d.y -= ph;
      const im = img.get(p.id);
      if (im) d.cover(im, M, d.y, CW, ph, 8);
      else { d.box(M, d.y, CW, ph, 8, CREAM, LINE); d.text("Fotografia nu s-a putut include", M, d.y + ph / 2, { size: 9, color: MUTED, maxW: CW, align: "center" }); }
      d.page.drawCircle({ x: M + 16, y: d.y + ph - 16, size: 9, color: DARK });
      d.text(String(i + 1), M + 7, d.y + ph - 19, { f: d.fb, size: 7.5, color: WHITE, maxW: 18, align: "center" });
      d.y -= cap;
      d.text(p.room ?? p.name ?? "Fotografie", M, d.y + 3, { f: d.fb, size: 8.5, maxW: CW - 90 });
      if (p.taken_at) d.text(fmtDate(p.taken_at, true), W - M - 90, d.y + 3, { size: 8, color: MUTED, maxW: 90, align: "right" });
      d.y -= 12;
    });
  }

  /* ---------- the footers, once the page count is known ---------- */
  const foot = `Fișă de inspecție ${code} · ${firmLine}${firm?.corp_no ? ` · Autorizație ANEVAR nr. ${firm.corp_no}` : !firm && x.assignee_legit ? ` · leg. ANEVAR ${x.assignee_legit}` : ""}${x.finished_at ? ` · ${fmtDate(x.finished_at)}` : ""}`;
  d.pages.forEach((p, i) => {
    d.page = p;
    d.line(M, W - M, 34);
    d.text(foot, M, 23, { size: 7.5, color: MUTED, maxW: CW - 90 });
    d.text(`${i + 1} / ${d.pages.length}`, W - M - 80, 23, { size: 7.5, color: MUTED, maxW: 80, align: "right" });
  });

  pdf.setTitle(`Fișă de inspecție ${code} · ${x.address}`);
  pdf.setSubject(title);
  pdf.setLanguage("ro-RO");
  pdf.setCreator(firmLine);
  pdf.setProducer(firmLine);
  return pdf.save();
}

/** A safe file name for the download: "Fisa-de-inspectie-FI-2026-0012.pdf". */
export const sheetPdfName = (x: Pick<Insp, "sheet_no" | "code" | "prop_type" | "cad_nr">) =>
  `Fisa-de-inspectie-${[x.prop_type, x.cad_nr ?? x.sheet_no ?? x.code].filter(Boolean).join("-").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}.pdf`;
