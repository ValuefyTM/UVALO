"use client";

// The new home: the tools as a carousel (arrows, dots, swipe / scroll), each with its own icon (Word and Chrome recognisable).
import { useEffect, useRef, useState } from "react";

export type HdTool = { key: string; href: string | null; name: string; desc: string; tag?: string; dark?: boolean };

const ICONS: Record<string, React.ReactNode> = {
  localizare: <><rect width="48" height="48" rx="12" fill="#141414" /><path d="M10 14h12v10H10zM26 14h12v8H26zM10 28h10v8H10zM24 26h14v10H24z" fill="none" stroke="#5A5A5A" strokeWidth="1.5" /><path d="M24 11c-4 0-7 3-7 7 0 5 7 12 7 12s7-7 7-12c0-4-3-7-7-7z" fill="#E0AD4F" /><circle cx="24" cy="18" r="2.6" fill="#141414" /></>,
  amplasament: <><rect width="48" height="48" rx="12" fill="#FBF4E6" /><circle cx="24" cy="24" r="13" fill="none" stroke="#9A5F00" strokeWidth="2" /><circle cx="24" cy="24" r="6" fill="none" stroke="#E0AD4F" strokeWidth="2" /><path d="M24 7v6M24 35v6M7 24h6M35 24h6" stroke="#9A5F00" strokeWidth="2" strokeLinecap="round" /><circle cx="24" cy="24" r="2" fill="#141414" /></>,
  comparabile: <><rect width="48" height="48" rx="12" fill="#EEF3FB" /><rect x="11" y="26" width="6" height="12" rx="1.5" fill="#2F5DA8" /><rect x="21" y="18" width="6" height="20" rx="1.5" fill="#E0AD4F" /><rect x="31" y="22" width="6" height="16" rx="1.5" fill="#2F5DA8" /><path d="M10 14l8-3 8 4 10-5" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
  word: <><rect x="14" y="6" width="28" height="36" rx="4" fill="#41A5EE" /><rect x="14" y="6" width="28" height="12" rx="4" fill="#2B7CD3" /><rect x="14" y="30" width="28" height="12" rx="4" fill="#185ABD" /><rect x="5" y="13" width="22" height="22" rx="4" fill="#103F91" /><path d="M9.5 18.5l2.6 11 3-8.4 3 8.4 2.6-11" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></>,
  chrome: <><circle cx="24" cy="24" r="20" fill="#DB4437" /><path d="M24 24 L41.3 14 A20 20 0 0 1 24 44 Z" fill="#F4B400" /><path d="M24 24 L24 44 A20 20 0 0 1 6.7 14 Z" fill="#0F9D58" /><circle cx="24" cy="24" r="9" fill="#fff" /><circle cx="24" cy="24" r="7" fill="#4285F4" /></>,
  cf: <><rect width="48" height="48" rx="12" fill="#2A2A2A" /><path d="M15 9h13l7 7v23H15z" fill="#fff" /><path d="M28 9v7h7" fill="#E6DFCF" /><path d="M19 22h12M19 27h12M19 32h8" stroke="#9A9A9A" strokeWidth="2" strokeLinecap="round" /><circle cx="35" cy="35" r="7" fill="#E0AD4F" /><path d="M32 35h6M35 32v6" stroke="#141414" strokeWidth="2" strokeLinecap="round" /></>,
  analize: <><rect width="48" height="48" rx="12" fill="#F3EEE4" /><path d="M14 34h20M17 30v-6M24 30V16M31 30v-9" stroke="#9A9384" strokeWidth="2.4" strokeLinecap="round" /></>,
};

export function HdTools({ tools }: { tools: HdTool[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ i: 0, pages: 1, start: true, end: true });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const upd = () => {
      const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05));
      setPos({ i: Math.round(el.scrollLeft / Math.max(1, el.clientWidth)), pages, start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    };
    upd();
    el.addEventListener("scroll", upd, { passive: true });
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => { el.removeEventListener("scroll", upd); ro.disconnect(); };
  }, []);
  const go = (d: number) => track.current?.scrollBy({ left: d * Math.max(230, track.current.clientWidth - 60), behavior: "smooth" });
  return (
    <section className="hdTools" aria-labelledby="hdToolsT">
      <div className="hdHead">
        <h2 id="hdToolsT">Instrumente</h2>
        <span className="hdCar">
          {pos.pages > 1 && Array.from({ length: pos.pages }, (_, k) => <i key={k} className={k === Math.min(pos.i, pos.pages - 1) ? "on" : ""} />)}
          <button type="button" aria-label="Înapoi" disabled={pos.start} onClick={() => go(-1)}>‹</button>
          <button type="button" aria-label="Înainte" disabled={pos.end} onClick={() => go(1)}>›</button>
        </span>
      </div>
      <div className="hdTrack" ref={track}>
        {tools.map((t) => {
          const body = (
            <>
              <span className="hdToolTop">
                <svg width="42" height="42" viewBox="0 0 48 48" aria-hidden="true">{ICONS[t.key] ?? ICONS.analize}</svg>
                {t.tag && <small className={`hdToolTag${t.tag === "AI" ? " ai" : t.tag === "folosit" ? " ok" : ""}`}>{t.tag}</small>}
              </span>
              <span className="hdToolText"><b>{t.name}</b><small className={t.href ? "" : "soon"}>{t.desc}</small></span>
            </>
          );
          return t.href
            ? <a key={t.key} href={t.href} className={`hdTool${t.dark ? " dark" : ""}`}>{body}</a>
            : <div key={t.key} className="hdTool soon">{body}</div>;
        })}
      </div>
    </section>
  );
}
