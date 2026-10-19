"use client";
// "Contul meu" → Semnătura: drawn here (mouse / finger) or uploaded as a picture; kept as a small PNG with a transparent
// background. It goes on the inspection sheet at "Evaluator" once the sheet is finished, and with the sheet to the firm's
// integrated software (API). Only the person changes it.
import { useEffect, useRef, useState } from "react";

const W = 900, H = 300;

/** A picture of a signature → PNG data URL on a transparent background, at most W × H (white-ish pixels made transparent). */
async function fromImage(file: File) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, W / bmp.width, H / bmp.height), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const lum = (p[i] + p[i + 1] + p[i + 2]) / 3;
    if (lum > 225) p[i + 3] = 0; // paper → transparent
    else if (lum > 150) p[i + 3] = Math.round(p[i + 3] * (225 - lum) / 75); // soft edges
  }
  g.putImageData(d, 0, 0);
  return c.toDataURL("image/png");
}

export function SignatureCard({ initial }: { initial: string | null }) {
  const [saved, setSaved] = useState<string | null>(initial);
  const [mode, setMode] = useState<"view" | "draw">(initial ? "view" : "draw");
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const cv = useRef<HTMLCanvasElement>(null), drawing = useRef(false), file = useRef<HTMLInputElement>(null);
  // the pad is set up at the size it has on screen, sharp on dense screens
  useEffect(() => {
    if (mode !== "draw") return;
    const c = cv.current!, r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1;
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext("2d")!; g.scale(k, k); g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#141414";
    setInked(false);
  }, [mode]);
  const pt = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const clear = () => { const c = cv.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setInked(false); };
  const save = async (v: string | null) => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/account/signature", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature: v }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r?.ok) return setMsg(d.error ?? "Nu a mers. Încearcă din nou.");
    setSaved(v); setMode(v ? "view" : "draw"); setMsg(v ? "Semnătura a fost salvată. Apare pe fișele de inspecție finalizate de acum înainte." : "Semnătura a fost ștearsă.");
  };
  const fromPad = () => {
    // only the drawn area, with a little room around it (not the whole pad)
    const c = cv.current!, g = c.getContext("2d")!, d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return null;
    const pad = 12, o = document.createElement("canvas");
    o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
    o.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL("image/png");
  };
  return (
    <section className="card sgCard" id="semnatura">
      <span className="eyebrow">Semnătura ta</span>
      <p className="hint" style={{ margin: 0 }}>Se pune automat pe fișa de inspecție, la „Evaluator”, când fișa e finalizată, și se trimite împreună cu fișa aplicațiilor integrate ale firmei (CRM). Semnătura persoanei prezente se ia în continuare pe telefon.</p>
      {mode === "view" && saved ? (
        <div className="sgView">
          <div className="sgPreview"><img src={saved} alt="Semnătura ta" /></div>
          <span className="actions">
            <button type="button" className="btn btnGhost btnSm" onClick={() => setMode("draw")} disabled={busy}>Schimbă</button>
            <button type="button" className="btn btnGhost btnSm" onClick={() => { if (confirm("Ștergi semnătura? Fișele finalizate de acum înainte nu o vor mai avea.")) void save(null); }} disabled={busy}>Șterge</button>
          </span>
        </div>
      ) : (
        <div className="sgDraw">
          <canvas ref={cv} className="sgPad" aria-label="Semnează aici"
            onPointerDown={(e) => { drawing.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.beginPath(); g.moveTo(a, b); }}
            onPointerMove={(e) => { if (!drawing.current) return; const [a, b] = pt(e); const g = cv.current!.getContext("2d")!; g.lineTo(a, b); g.stroke(); setInked(true); }}
            onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
          <span className="actions">
            <button type="button" className="btn btnGold btnSm" disabled={busy || !inked} onClick={() => { const v = fromPad(); if (v) void save(v); }}>Salvează semnătura</button>
            <button type="button" className="btn btnGhost btnSm" disabled={busy || !inked} onClick={clear}>Curăță</button>
            <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => file.current?.click()}>Încarcă o poză cu semnătura</button>
            {saved && <button type="button" className="lnk" onClick={() => setMode("view")}>Renunță</button>}
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { void save(await fromImage(f)); } catch { setMsg("Poza nu a putut fi citită."); } }} />
          </span>
          <small className="hint">Semnează cu mouse-ul sau cu degetul, cât mai mare. Dintr-o poză, hârtia albă devine transparentă.</small>
        </div>
      )}
      {msg && <small className="muted" role="status">{msg}</small>}
    </section>
  );
}
