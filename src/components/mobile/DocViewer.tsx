"use client";
// The documents of an inspection (CF, floor plan, other papers) while filling in the sheet on the phone: a small floating
// button opens them over the sheet (the sheet stays where it was), chips choose the document, zoom with − / + or a double
// tap. Images show as they are; PDFs are drawn page by page with pdf.js (the copy the Word add-in ships, /word/lib/pdfjs/).
// Each file is fetched once and kept in memory while the sheet is open.
import { useEffect, useRef, useState } from "react";

export type Doc = { id: string; kind: string; name: string | null };
const KIND: Record<string, string> = { cf: "CF", releveu: "Releveu", doc: "Document" };
const ORDER: Record<string, number> = { cf: 0, releveu: 1, doc: 2 };
const ZOOMS = [1, 1.5, 2, 3];

type Loaded = { blob: Blob; pdf: boolean; url: string };
type PdfLib = { GlobalWorkerOptions: { workerSrc: string }; getDocument: (o: object) => { promise: Promise<PdfDoc> } };
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => void };
type PdfPage = { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } };

let pdfLib: Promise<PdfLib> | null = null;
function pdfjs() {
  if (!pdfLib) {
    const base = `${location.origin}/word/lib/pdfjs/`;
    // an absolute URL import (the module is a static file of the platform, not part of the app bundle)
    pdfLib = (new Function("u", "return import(u)") as (u: string) => Promise<PdfLib>)(`${base}pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`; return m; });
    pdfLib.catch(() => { pdfLib = null; });
  }
  return pdfLib;
}

/** The floating button + the overlay. `docs` = the inspection's files that are not photos / signature. */
export function DocViewer({ docs }: { docs: Doc[] }) {
  const list = [...docs].sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string>(list[0]?.id ?? "");
  const [zoom, setZoom] = useState(1);
  const [cache, setCache] = useState<Record<string, Loaded>>({});
  const [err, setErr] = useState("");
  const cur = list.find((d) => d.id === sel) ?? list[0];
  // the chosen document is fetched once (its type comes from the response, not from the name)
  useEffect(() => {
    if (!open || !cur || cache[cur.id]) return;
    let dead = false;
    setErr("");
    fetch(`/api/inspectii/file/${cur.id}`).then(async (r) => {
      if (!r.ok) throw new Error(r.status === 404 ? "Fișierul nu mai există." : "Nu am putut descărca actul.");
      const blob = await r.blob();
      const pdf = blob.type.includes("pdf") || /\.pdf$/i.test(cur.name ?? "");
      if (!dead) setCache((c) => ({ ...c, [cur.id]: { blob, pdf, url: URL.createObjectURL(blob) } }));
    }).catch((e) => { if (!dead) setErr(navigator.onLine ? String(e.message || "Nu am putut descărca actul.") : "Fără semnal: actul se deschide când ai rețea."); });
    return () => { dead = true; };
  }, [open, cur, cache]);
  // the object URLs live as long as the viewer (revoking them on every change broke the documents already shown)
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  useEffect(() => () => Object.values(cacheRef.current).forEach((l) => URL.revokeObjectURL(l.url)), []);
  if (!list.length) return null;
  const nextZoom = () => setZoom((z) => ZOOMS[(ZOOMS.indexOf(z) + 1) % ZOOMS.length] ?? 1);
  const loaded = cur ? cache[cur.id] : undefined;
  return (
    <>
      <button type="button" className={`mbDocFab${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-label={open ? "Înapoi la fișă" : `Acte (${list.length})`} title={open ? "Înapoi la fișă" : "Acte"}>
        {open
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>}
        {!open && <i>{list.length}</i>}
      </button>
      {open && cur && (
        <div className="mbDocView" role="dialog" aria-label="Acte">
          <div className="mbDocTop">
            <span className="mbDocChips">
              {list.map((d) => <button key={d.id} type="button" aria-pressed={d.id === cur.id} onClick={() => { setSel(d.id); setZoom(1); }}>{KIND[d.kind] ?? "Doc"}{d.name && list.filter((x) => x.kind === d.kind).length > 1 ? ` · ${d.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 14)}` : ""}</button>)}
            </span>
            <span className="mbDocZoom">
              <button type="button" onClick={() => setZoom((z) => Math.max(1, ZOOMS[ZOOMS.indexOf(z) - 1] ?? 1))} aria-label="Micșorează" disabled={zoom === 1}>−</button>
              <b>{Math.round(zoom * 100)}%</b>
              <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)] ?? z)} aria-label="Mărește" disabled={zoom === ZOOMS[ZOOMS.length - 1]}>+</button>
              <button type="button" className="mbDocClose" onClick={() => setOpen(false)} aria-label="Înapoi la fișă">×</button>
            </span>
          </div>
          <div className="mbDocBody" onDoubleClick={nextZoom}>
            {err ? <p className="mbDocMsg">{err}</p>
              : !loaded ? <p className="mbDocMsg">Se încarcă {KIND[cur.kind]?.toLowerCase() ?? "actul"}…</p>
              : loaded.pdf ? <PdfPages key={cur.id} blob={loaded.blob} zoom={zoom} />
              : <img src={loaded.url} alt={cur.name ?? KIND[cur.kind]} style={{ width: `${zoom * 100}%` }} />}
          </div>
          <small className="mbDocHint">{cur.name ?? KIND[cur.kind]} · atinge de două ori pentru zoom · <a href={`/api/inspectii/file/${cur.id}`} target="_blank" rel="noopener">deschide separat</a></small>
        </div>
      )}
    </>
  );
}

/** The pages of a PDF, drawn at the width of the screen × zoom (sharp on high-density screens). */
function PdfPages({ blob, zoom }: { blob: Blob; zoom: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const [gen, setGen] = useState(0); // bumps when a document is ready, so the pages are drawn even if the count is unchanged
  const [fail, setFail] = useState("");
  const docRef = useRef<PdfDoc | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const lib = await pdfjs();
        const base = `${location.origin}/word/lib/pdfjs/`;
        const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/` }).promise;
        if (dead) { doc.destroy(); return; }
        docRef.current = doc;
        setN(doc.numPages); setGen((g) => g + 1);
      } catch { if (!dead) setFail("PDF-ul nu a putut fi afișat aici. Deschide-l separat (linkul de jos)."); }
    })();
    return () => { dead = true; docRef.current?.destroy(); docRef.current = null; };
  }, [blob]);
  // draw (again) every page at the current width
  useEffect(() => {
    const doc = docRef.current, el = box.current;
    if (!doc || !el || !n) return;
    let dead = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 3), width = (el.clientWidth || 360) * zoom;
    (async () => {
      for (let p = 1; p <= n && !dead; p++) {
        const page = await doc.getPage(p);
        const v1 = page.getViewport({ scale: 1 }), s = width / v1.width, v = page.getViewport({ scale: s * dpr });
        const c = el.querySelector<HTMLCanvasElement>(`canvas[data-p="${p}"]`);
        if (!c) continue;
        c.width = v.width; c.height = v.height; c.style.width = `${v.width / dpr}px`; c.style.height = `${v.height / dpr}px`;
        await page.render({ canvasContext: c.getContext("2d")!, viewport: v }).promise;
      }
    })().catch(() => setFail("PDF-ul nu a putut fi desenat."));
    return () => { dead = true; };
  }, [n, gen, zoom]);
  if (fail) return <p className="mbDocMsg">{fail}</p>;
  return (
    <div ref={box} className="mbDocPages">
      {!n && <p className="mbDocMsg">Se pregătește PDF-ul…</p>}
      {Array.from({ length: n }, (_, i) => <canvas key={i} data-p={i + 1} />)}
    </div>
  );
}
