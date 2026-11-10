"use client";

// The new home, the phone: a pill in the dark header (connected → its state; never installed → "Telefon neconectat · Conectează")
// and a plain button ("Conectează telefonul") in the inspections' empty state. Both open the window with the QR code (it also
// signs the phone in, a one-time code) and the install steps for iPhone / Android.
import { useEffect, useRef, useState } from "react";
import { qrSvg } from "./mobile/InstallHint";

const PhoneIco = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" />
  </svg>
);

export function HdPhone({ installed, title, lines, appUrl, variant = "pill" }: { installed: boolean; title: string; lines: string[]; appUrl: string; variant?: "pill" | "btn" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "btn" ? (
        <button type="button" className="hbBtn line" onClick={() => setOpen(true)}><PhoneIco size={14} />{installed ? "Reinstalează aplicația" : "Conectează telefonul"}</button>
      ) : installed ? (
        <button type="button" className="hbPhone on" onClick={() => setOpen(true)} title="Instalează din nou aplicația pe telefon (alt telefon, aplicația ștearsă)">
          <i aria-hidden="true" />
          <span><b>{title}</b><small>{lines.join(" · ")}</small></span>
        </button>
      ) : (
        <button type="button" className="hbPhone" onClick={() => setOpen(true)}>
          <i aria-hidden="true" />
          <span><b>Telefon neconectat</b><small>instalează aplicația <em>Conectează →</em></small></span>
        </button>
      )}
      {open && <InstallModal appUrl={appUrl} again={installed} onClose={() => setOpen(false)} />}
    </>
  );
}

export function InstallModal({ appUrl, again, onClose }: { appUrl: string; again: boolean; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const host = appUrl.replace(/^https?:\/\//, "");
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    // a one-time code (10 minutes): the QR opens the app already signed in to this account
    fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pair_code" }) })
      .then((r) => r.json().then((x: unknown) => { const j = x as { code?: string; token?: string; error?: string }; if (!r.ok || !j.code) throw new Error(j.error || "Nu am putut face codul."); setCode(j.token ?? j.code); }))
      .catch((e) => setErr((e as Error).message));
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  const url = code ? `${appUrl}/?pair=${encodeURIComponent(code)}` : appUrl; // code = the QR token here
  return (
    <div className="hdModalBg" onClick={onClose}>
      <div className="hdModal" role="dialog" aria-modal="true" aria-labelledby="hdInstT" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="hdModalX" aria-label="Închide" onClick={onClose}>×</button>
        <h2 id="hdInstT">{again ? "Reinstalează aplicația pe telefon" : "Instalează aplicația UVALO pe telefon"}</h2>
        <p className="hdMuted">Scanează codul cu camera telefonului: se deschide aplicația, deja conectată la contul tău.</p>
        <div className="hdInstBody">
          <div className="hdInstQr">
            <span dangerouslySetInnerHTML={{ __html: qrSvg(url, 4) }} />
            <small>{code ? "Codul e valabil 10 minute" : err || "Se pregătește codul…"}</small>
            <small>sau deschide <b>{host}</b></small>
          </div>
          <div className="hdInstSteps">
            <b>iPhone (Safari)</b>
            <ol>
              <li>Scanează codul și deschide linkul în <b>Safari</b>.</li>
              <li>Atinge <b>Partajează</b> (pătratul cu săgeata în sus).</li>
              <li>Alege <b>„Adaugă pe ecranul principal”</b>, apoi <b>Adaugă</b>.</li>
            </ol>
            <b>Android (Chrome)</b>
            <ol>
              <li>Scanează codul și deschide linkul în <b>Chrome</b>.</li>
              <li>Atinge <b>Instalează</b> din fereastra de jos sau din meniul <b>⋮</b> → <b>„Instalează aplicația”</b>.</li>
            </ol>
            <p className="hdMuted">Aplicația apare pe ecran cu numele <b>UVALO</b>. Deschide-o de acolo și permite camera, locația și notificările.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
