"use client";

import { useEffect, useState } from "react";
import { detect, qrSvg } from "./mobile/InstallHint";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Kind = ReturnType<typeof detect>;

/**
 * Admin → Panou: "UVALO Admin" on the phone (the admin area installed as an app, manifest /api/admin/manifest).
 * Computer → QR to /admin; iPhone → Share → Add to Home Screen (Safari only); Android → install button or the ⋮ menu.
 * Nothing inside the installed app; hidden for 30 days at "×".
 */
export function AdminInstall() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [hide, setHide] = useState(true);
  useEffect(() => {
    setKind(detect());
    try { setHide(Date.now() - Number(localStorage.getItem("adm-install-off") || 0) < 30 * 864e5); } catch { setHide(false); }
    const on = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (!kind || kind === "standalone" || hide) return null;
  const close = () => { setHide(true); try { localStorage.setItem("adm-install-off", String(Date.now())); } catch {} };
  const url = `${location.origin}/admin`;
  return (
    <section className="card admInstall">
      <button type="button" className="admInstallX" aria-label="Închide" onClick={close}>×</button>
      {kind === "desktop" && <span className="admQr" dangerouslySetInnerHTML={{ __html: qrSvg(url, 4) }} />}
      <div>
        <h2>UVALO Admin pe telefon</h2>
        {kind === "desktop" && <p className="hint">Scanează codul cu telefonul (sau deschide <b>{location.host}/admin</b>) și instalează panoul ca aplicație: statisticile, cine e online, solicitările și conturile, cu meniul jos.</p>}
        {kind === "ios-safari" && <p className="hint">Apasă <b>Partajează</b> în bara Safari, apoi <b>„Adaugă pe ecranul principal”</b>. Panoul de admin se deschide apoi de pe ecran, fără bara browserului.</p>}
        {kind === "ios-other" && <p className="hint">Pe iPhone se instalează doar din <b>Safari</b>: deschide <b>{location.host}/admin</b> în Safari, apoi Partajează → „Adaugă pe ecranul principal”.</p>}
        {(kind === "android" || kind === "android-inapp") && !bip && <p className="hint">Deschide meniul browserului <b>⋮</b> și alege <b>„Instalează aplicația”</b> sau „Adaugă pe ecranul de pornire”.</p>}
        {bip && <>
          <p className="hint">Panoul de admin se pune pe ecranul principal și se deschide fără bara browserului.</p>
          <button type="button" className="btn btnNavy btnSm" onClick={async () => { await bip.prompt(); if ((await bip.userChoice).outcome === "accepted") setHide(true); }}>Instalează UVALO Admin</button>
        </>}
      </div>
    </section>
  );
}
