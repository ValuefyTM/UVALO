"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Inspecții → the gear in the page's top corner: the inspection sheets and the module's other settings (more will come here).
 * `children` = extra rows rendered by the page (e.g. the connected phone).
 */
export function InspSettings({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  const ico = (d: React.ReactNode) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
  return (
    <div className="inSet" ref={box}>
      <button type="button" className="btn btnGhost inSetBtn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)} title="Setări inspecții">
        {ico(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>)}
        <span>Setări</span>
      </button>
      {open && (
        <div className="inSetMenu" role="menu">
          <small className="inSetCap">INSPECȚII</small>
          <a role="menuitem" href="/inspectii/fise">
            {ico(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>)}
            <span><b>Fișe de inspecție</b><small>Întrebările, încăperile, publicarea pe versiuni</small></span>
          </a>
          {children}
          <span className="inSetSoon" role="menuitem" aria-disabled="true">
            {ico(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>)}
            <span><b>Notificări și mementouri</b><small>În curând</small></span>
          </span>
          <span className="inSetSoon" role="menuitem" aria-disabled="true">
            {ico(<><path d="M3 7h18M3 12h18M3 17h12" /></>)}
            <span><b>Câmpuri implicite și numerotare</b><small>În curând</small></span>
          </span>
        </div>
      )}
    </div>
  );
}
