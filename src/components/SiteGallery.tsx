"use client";
// Landing (uvalo.ro): the UVALO pentru Word picture opens a larger gallery with the add-in's screens.
import { useEffect, useState } from "react";

const SLIDES = [
  { group: "ANEXĂ DOCUMENTE", title: "Documentele PDF, în ordinea din raport", src: "/word/prezentare/doc-1-lista.webp", alt: "Panoul Anexă documente cu lista de PDF-uri încărcate și paginile lor", text: "Încarci extrasul CF, releveul, actele: fiecare document cu paginile lui, pe care le bifezi pe cele care intră în anexă." },
  { group: "ANEXĂ DOCUMENTE", title: "Restrângi documentele și le muți", src: "/word/prezentare/doc-2-restranse.webp", alt: "Documentele restrânse, mutate prin tragere de mâner", text: "Restrângi paginile ca să vezi doar lista și muți documentele trăgându-le de mâner." },
  { group: "ANEXĂ DOCUMENTE", title: "Previzualizare înainte de inserare", src: "/word/prezentare/doc-3-previzualizare.webp", alt: "Previzualizarea anexei cu documente", text: "Vezi anexa exact cum va arăta în raport, apoi o inserezi la cursor sau înlocuiești anexa existentă." },
  { group: "ANEXĂ FOTO", title: "Pozele de la inspecție, cu descrieri", src: "/word/prezentare/foto-1-lista.webp", alt: "Panoul Anexă foto cu lista de poze și descrierile lor", text: "Încarci pozele, scrii descrierea fiecăreia și alegi câte intră pe pagină." },
  { group: "ANEXĂ FOTO", title: "Le aranjezi pe pagini", src: "/word/prezentare/foto-2-aranjare.webp", alt: "Aranjarea pozelor în pagină", text: "Ordinea și titlurile le schimbi din panou; lucrul rămâne salvat dacă închizi panoul." },
  { group: "ANEXĂ FOTO", title: "Previzualizare și inserare în raport", src: "/word/prezentare/foto-3-previzualizare.webp", alt: "Previzualizarea anexei foto", text: "Anexa foto se inserează în documentul Word deschis, cu titluri și numerotare." },
];

export function SiteGallery() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const go = (k: number) => setI((k + SLIDES.length) % SLIDES.length);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowLeft") setI((k) => (k - 1 + SLIDES.length) % SLIDES.length);
      else if (e.key === "ArrowRight") setI((k) => (k + 1) % SLIDES.length);
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [open]);
  const s = SLIDES[i];
  return (
    <>
      <button type="button" className="ldShot" onClick={() => { setI(0); setOpen(true); }} aria-label="Deschide galeria UVALO pentru Word">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/word/prezentare/hero-doc.webp" alt="Word cu panoul UVALO Anexă documente: documentele PDF ordonate, gata de inserat în raport" loading="lazy" />
        <span className="ldShotBadge">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>
          {SLIDES.length} imagini
        </span>
      </button>
      {open && (
        <div className="ldModal" role="dialog" aria-modal="true" aria-label="UVALO pentru Word, galerie" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="ldModalBox">
            <div className="ldModalHead">
              <span><small>{s.group}</small><b>{s.title}</b></span>
              <span className="ldModalTools"><small>{i + 1} / {SLIDES.length}</small><button type="button" className="ldClose" onClick={() => setOpen(false)} aria-label="Închide galeria">×</button></span>
            </div>
            <div className="ldModalImg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.alt} />
              <button type="button" className="ldNav prev" onClick={() => go(i - 1)} aria-label="Imaginea anterioară">‹</button>
              <button type="button" className="ldNav next" onClick={() => go(i + 1)} aria-label="Imaginea următoare">›</button>
            </div>
            <div className="ldModalFoot">
              <p>{s.text}</p>
              <div className="ldThumbs">
                {SLIDES.map((x, k) => (
                  <button key={x.src} type="button" onClick={() => go(k)} aria-label={x.title} aria-current={k === i ? "true" : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.src} alt="" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
