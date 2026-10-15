"use client";

import { useEffect, useRef, useState } from "react";

export type WebNotif = { id: number; insp: string; at: string; text: string; address: string; who: string | null };

const KEY = "insp-web-notif-seen";
const ago = (at: string) => {
  const m = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (m < 1) return "acum";
  if (m < 60) return `acum ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `acum ${h} h`;
  return new Date(at).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
};

/** Inspecții → the bell in the header: what others did on my inspections (30 days); unread = newer than the last open (localStorage). */
export function InspBell({ items }: { items: WebNotif[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { try { setSeen(localStorage.getItem(KEY)); } catch {} setReady(true); }, []);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  const unread = ready ? items.filter((n) => !seen || n.at > seen).length : 0;
  const toggle = () => {
    // opening marks everything as read (the dots stay visible while the list is open)
    if (!open && items[0]) { try { localStorage.setItem(KEY, items[0].at); } catch {} }
    if (open) setSeen(items[0]?.at ?? seen);
    setOpen(!open);
  };
  return (
    <div className="inSet inBell" ref={box}>
      <button type="button" className="btn btnGhost inBellBtn" aria-expanded={open} aria-haspopup="menu" onClick={toggle}
        title="Notificări" aria-label={unread ? `Notificări, ${unread} noi` : "Notificări"}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="inBellDot">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="inSetMenu inBellMenu" role="menu">
          <small className="inSetCap">NOTIFICĂRI · ULTIMELE 30 DE ZILE</small>
          {!items.length && <p className="inBellEmpty">Nimic nou. Aici apare ce fac colegii pe inspecțiile tale: programări, fișe completate, poze, retrimiteri.</p>}
          <div className="inBellList">
            {items.map((n) => (
              <a key={n.id} role="menuitem" href={`/inspectii/${n.insp}`} className={!seen || n.at > seen ? "new" : undefined}>
                <i aria-hidden="true" />
                <span><b>{n.text}</b><small>{n.address}</small><small>{n.who ? `${n.who} · ` : ""}{ago(n.at)}</small></span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
