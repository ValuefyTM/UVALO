"use client";

import { useState } from "react";

/**
 * „Previzualizează aplicația”: the phone app (inspectii.uvalo.ro) in a phone frame, right on the web page. It signs in by
 * itself with a one-time pairing code; a computer's browser is not counted as a connected phone.
 */
export function InspPreview({ appUrl }: { appUrl: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const open = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pair_code" }) });
      const j = (await r.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!r.ok || !j.code) throw new Error(j.error || "Nu am putut deschide previzualizarea.");
      setSrc(`${appUrl}/?pair=${j.code}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className="btn btnGhost" disabled={busy} onClick={open} title="Aplicația de telefon, aici în pagină">
        {busy ? "Se deschide…" : "Previzualizează aplicația"}
      </button>
      {err && <span className="inDocMsg" role="alert">{err}</span>}
      {src && (
        <div className="inPrevBg" onClick={() => setSrc(null)}>
          <div className="inPrev" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Aplicația de telefon">
            <div className="inPrevBar">
              <b>Aplicația de telefon</b>
              <span>
                <button type="button" className="linkBtn" onClick={() => { const f = document.getElementById("inPrevFrame") as HTMLIFrameElement | null; if (f) f.src = `${appUrl}/`; }}>Reîncarcă</button>
                <a className="linkBtn" href={`${appUrl}/`} target="_blank" rel="noopener">Filă nouă ↗</a>
                <button type="button" className="inPrevX" aria-label="Închide" onClick={() => setSrc(null)}>×</button>
              </span>
            </div>
            <div className="inPhone">
              <iframe id="inPrevFrame" src={src} title="Aplicația de inspecții" allow="geolocation; camera; clipboard-write" />
            </div>
            <p className="hint">Datele sunt cele reale: ce faci aici se salvează. Camera și notificările merg doar pe telefon.</p>
          </div>
        </div>
      )}
    </>
  );
}
