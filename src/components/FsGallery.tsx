"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Ph = { id: string; src: string; room: string; when: string };

/** The public sheet's photos by category, opened full screen (arrows, keys, swipe). */
export function FsGallery({ groups }: { groups: { r: string; ph: Ph[] }[] }) {
  const all = groups.flatMap((g) => g.ph);
  const [at, setAt] = useState<number | null>(null);
  const x0 = useRef<number | null>(null);
  const go = useCallback((d: number) => setAt((i) => (i == null ? i : (i + d + all.length) % all.length)), [all.length]);
  useEffect(() => {
    if (at == null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAt(null); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [at, go]);
  const cur = at == null ? null : all[at];
  return (
    <>
      {groups.map(({ r, ph }) => (
        <div key={r} className="fsPhGroup">
          <h3>{r} <small>{ph.length}</small></h3>
          <div className="fsPhotos">
            {ph.map((p) => (
              <button key={p.id} type="button" onClick={() => setAt(all.indexOf(p))} aria-label={`Deschide fotografia ${r}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={r} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </div>
      ))}
      {cur && (
        <div className="fsLb" role="dialog" aria-label="Fotografie" onClick={() => setAt(null)}
          onTouchStart={(e) => { x0.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (x0.current == null) return; const d = e.changedTouches[0].clientX - x0.current; x0.current = null; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.src} alt={cur.room} onClick={(e) => e.stopPropagation()} />
          <span className="fsLbCap"><b>{cur.room}</b>{cur.when && ` · ${cur.when}`} · {at! + 1} / {all.length}</span>
          <button type="button" className="fsLbX" aria-label="Închide" onClick={() => setAt(null)}>×</button>
          {all.length > 1 && <>
            <button type="button" className="fsLbNav prev" aria-label="Anterioara" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
            <button type="button" className="fsLbNav next" aria-label="Următoarea" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
          </>}
        </div>
      )}
    </>
  );
}

export function FsPrint() {
  return <button type="button" className="fsBtn" onClick={() => window.print()}>Descarcă PDF</button>;
}
