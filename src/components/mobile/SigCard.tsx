"use client";
// Phone app → Contul meu → "Semnătura mea": the valuer's signature, drawn with the finger, kept in the account
// (users.signature, the same as "Contul meu" on the web) and put automatically on every finished sheet where they are the inspector.
import { useEffect, useRef, useState } from "react";

export function SigCard({ hasSig, say }: { hasSig: boolean; say: (m: string) => void }) {
  const [saved, setSaved] = useState<string | null | undefined>(hasSig ? undefined : null); // undefined = loading
  const [draw, setDraw] = useState(false);
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null), drawing = useRef(false);
  useEffect(() => {
    if (!hasSig) return;
    fetch("/api/account/signature").then((r) => (r.ok ? (r.json() as Promise<{ signature?: string | null }>) : null)).then((d) => setSaved(d?.signature ?? null)).catch(() => setSaved(null));
  }, [hasSig]);
  useEffect(() => {
    if (!draw) return;
    const c = cv.current!, r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1;
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext("2d")!; g.scale(k, k); g.lineWidth = 2.6; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#141414";
    setInked(false);
  }, [draw]);
  const pt = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const clear = () => { const c = cv.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setInked(false); };
  // only the drawn area, with a little room around it (transparent background: the pad is never filled)
  const fromPad = () => {
    const c = cv.current!, d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return null;
    const pad = 12, o = document.createElement("canvas");
    o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
    o.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL("image/png");
  };
  const save = async (v: string | null) => {
    setBusy(true);
    const r = await fetch("/api/account/signature", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature: v }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r?.ok) return say(d.error ?? "Nu a mers. Verifică semnalul și încearcă din nou.");
    setSaved(v); setDraw(false);
    say(v ? "Semnătura a fost salvată. Se pune automat pe fișele pe care le finalizezi de acum înainte." : "Semnătura a fost ștearsă.");
  };
  return (
    <>
      <small className="mbCap">SEMNĂTURA MEA</small>
      <section className="mbCard mbSigCard">
        {saved === undefined ? <small>Se încarcă…</small> : draw ? (
          <>
            <span className="mbRowBetween"><small>Semnează în chenar, cu degetul</small><button type="button" className="mbLink" onClick={clear}>Șterge</button></span>
            <canvas ref={cv} className="mbSig" aria-label="Semnează aici cu degetul"
              onPointerDown={(e) => { drawing.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.beginPath(); g.moveTo(a, b); }}
              onPointerMove={(e) => { if (!drawing.current) return; const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.lineTo(a, b); g.stroke(); setInked(true); }}
              onPointerUp={() => { drawing.current = false; }} />
            <span className="mbOpts">
              <button type="button" className="mbBtn gold" disabled={busy || !inked} onClick={() => { const v = fromPad(); if (v) void save(v); }}>{busy ? "Se salvează…" : "Salvează semnătura"}</button>
              <button type="button" className="mbBtn" disabled={busy} onClick={() => setDraw(false)}>Renunță</button>
            </span>
          </>
        ) : saved ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="mbSigView"><img src={saved} alt="Semnătura ta" /></span>
            <small>Se pune automat la „Evaluator”, pe fiecare fișă pe care o finalizezi, și pleacă odată cu fișa în aplicațiile integrate ale firmei.</small>
            <span className="mbOpts">
              <button type="button" className="mbBtn" disabled={busy} onClick={() => setDraw(true)}>Semnează din nou</button>
              <button type="button" className="mbLink" disabled={busy} onClick={() => { if (confirm("Ștergi semnătura din cont? Fișele viitoare vor apărea fără ea.")) void save(null); }}>Șterge</button>
            </span>
          </>
        ) : (
          <>
            <small>Nu ai încă o semnătură în cont. Semneaz-o o dată aici și apare automat la „Evaluator” pe toate fișele pe care le finalizezi tu.</small>
            <button type="button" className="mbBtn gold" onClick={() => setDraw(true)}>Adaugă semnătura</button>
          </>
        )}
      </section>
    </>
  );
}
