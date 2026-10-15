"use client";
// Landing (uvalo.ro): the hero as a slider. Only the text and the picture change; the buttons (`actions`) stay put.
import { useEffect, useRef, useState, type ReactNode } from "react";

const BELL = <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>;

type Slide = { key: string; label: string; badge: string; soon?: boolean; kicker: string; title: ReactNode; lead: string; art: ReactNode };

const SLIDES: Slide[] = [
  {
    key: "colaborari", label: "Colaborări", badge: "NOU ÎN UVALO", kicker: "Colaborări între evaluatori autorizați ANEVAR",
    title: <>Găsești un coleg pentru inspecție <em>în câteva minute.</em></>,
    lead: "Publici lucrarea, colegii din zona proprietății primesc notificare și îți cer detalii. Alegi pe cine vrei și vă înțelegeți în chat. Sau preiei tu inspecții și rapoarte acolo unde lucrezi deja.",
    art: (
      <>
        <img src="/site/colaborari.png" alt="Un anunț de inspecție din Arad la 62 km, cu buget de 250 de lei, și o conversație între doi evaluatori despre extrasul CF" />
        <div className="ldToast">
          <span className="ldToastIc">{BELL}</span>
          <span><b>Anunț nou în zona ta</b><small>în aplicație și pe email, cu link direct</small></span>
        </div>
      </>
    ),
  },
  {
    key: "inspectii", label: "Inspecții", badge: "ÎN CURÂND", soon: true, kicker: "Inspecții pe teren, din telefon",
    title: <>Gata cu <em>hârtiile.</em></>,
    lead: "Fișa de inspecție, pozele, actele și semnătura clientului — completate pe teren, din telefon, și gata pe web pentru raport. Pentru tine și pentru biroul tău.",
    art: (
      <div className="ldDuo">
        <div className="ldBrowser">
          <div className="ldBrowserBar"><i /><i /><i /><span>app.uvalo.ro/inspectii</span></div>
          <img src="/site/inspectii-web.webp" alt="Lista de inspecții pe web: adrese, contact, programare, cine o face și starea fiecăreia" loading="lazy" />
        </div>
        <div className="ldPhone">
          <span className="ldPhoneIsland" aria-hidden="true" />
          <div className="ldPhoneScr"><img src="/site/inspectii-mob.webp" alt="Aplicația de telefon: următoarea inspecție, cele de completat și cele de făcut" loading="lazy" /></div>
        </div>
      </div>
    ),
  },
];

const EVERY = 7000;

export function HeroSlider({ actions }: { actions: ReactNode }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const go = (k: number) => setI((k + SLIDES.length) % SLIDES.length);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((k) => (k + 1) % SLIDES.length), EVERY);
    return () => clearTimeout(t);
  }, [i, paused]);
  return (
    <div className="ldWrap ldHeroGrid ldSlider" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current; touch.current = null;
        if (Math.abs(dx) > 50) { setPaused(true); go(i + (dx < 0 ? 1 : -1)); }
      }}
      aria-roledescription="carusel" aria-label="Noutăți UVALO">
      <div className="ldStack">
        <div className="ldSlides">
          {SLIDES.map((s, k) => (
            <div key={s.key} className={`ldSlideTxt${k === i ? " on" : ""}`} aria-hidden={k !== i} role="group" aria-roledescription="slide" aria-label={`${k + 1} din ${SLIDES.length}: ${s.label}`}>
              <span className="ldKicker"><span className={`ldBadge${s.soon ? " ldOutline" : ""}`}>{s.badge}</span><span>{s.kicker}</span></span>
              <h1 className="ldH ldH1">{s.title}</h1>
              <p className="ldLead">{s.lead}</p>
            </div>
          ))}
        </div>
        {actions}
        <div className="ldDots" role="tablist" aria-label="Alege">
          <button type="button" className="ldDotArrow" aria-label="Înapoi" onClick={() => { setPaused(true); go(i - 1); }}>‹</button>
          {SLIDES.map((s, k) => (
            <button key={s.key} type="button" role="tab" aria-selected={k === i} className={k === i ? "on" : undefined}
              onClick={() => { setPaused(true); setI(k); }}>
              <span>{s.label}</span>{k === i && !paused && <i key={i} style={{ animationDuration: `${EVERY}ms` }} />}
            </button>
          ))}
          <button type="button" className="ldDotArrow" aria-label="Înainte" onClick={() => { setPaused(true); go(i + 1); }}>›</button>
        </div>
      </div>
      <div className="ldSlides">
        {SLIDES.map((s, k) => (
          <div key={s.key} className={`ldHeroArt ldSlideArt${k === i ? " on" : ""}`} aria-hidden={k !== i}>{s.art}</div>
        ))}
      </div>
    </div>
  );
}
