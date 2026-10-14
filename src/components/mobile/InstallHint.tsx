"use client";

import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Kind = "standalone" | "ios-safari" | "ios-other" | "android-prompt" | "android" | "android-inapp" | "desktop";

/** Which browser / device: decides the install help (or none when the app is already installed). */
function detect(): Kind {
  const ua = navigator.userAgent;
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return "standalone";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|TikTok/i.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/i.test(ua)) return /; wv\)|FBAN|FBAV|Instagram|Line\/|WhatsApp/i.test(ua) ? "android-inapp" : "android";
  return "desktop";
}

export function qrSvg(text: string, cell = 5) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F6BD8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Partajează" role="img">
    <path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v8h14v-8" />
  </svg>
);

/**
 * How to install the app, by device: iPhone / Safari (Share → Add to Home Screen, pointing at the bar), iPhone in another
 * browser (only Safari installs: open in Safari), Android Chrome (install button), Android in an app (open in Chrome),
 * computer (QR to open on the phone). Hidden when installed or dismissed (for 3 days).
 */
export function InstallHint({ compact = false }: { compact?: boolean }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [hide, setHide] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setKind(detect());
    try { const t = Number(localStorage.getItem("insp-hint-off") || 0); if (Date.now() - t < 3 * 864e5) setHide(true); } catch {}
    const on = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (!kind || kind === "standalone" || (hide && kind !== "desktop")) return null;
  const close = () => { setHide(true); try { localStorage.setItem("insp-hint-off", String(Date.now())); } catch {} };
  const here = typeof location !== "undefined" ? location.href : "";
  const copy = () => { void navigator.clipboard?.writeText(here).then(() => setCopied(true)); };
  const k: Kind = kind === "android" && bip ? "android-prompt" : kind;

  if (k === "desktop") {
    return (
      <div className="mbHint mbHintDesk">
        <span className="mbQr" dangerouslySetInnerHTML={{ __html: qrSvg(here.replace(/\?.*$/, "")) }} />
        <span><b>Aplicația e pentru telefon</b><small>Scanează codul cu camera telefonului sau deschide <b>{typeof location !== "undefined" ? location.host : ""}</b> pe telefon, apoi instaleaz-o pe ecranul principal.</small></span>
      </div>
    );
  }
  return (
    <div className={`mbHint${k === "ios-safari" && !compact ? " mbHintIos" : ""}`} role="note">
      <button type="button" className="mbHintX" aria-label="Închide" onClick={close}>×</button>
      {k === "ios-safari" && <>
        <b>Instalează aplicația pe iPhone</b>
        <small>Apasă <ShareIcon /> <b>Partajează</b> în bara Safari, apoi <b>„Adaugă pe ecranul principal”</b>. Aplicația se deschide apoi de pe ecran, ca oricare alta.</small>
        {!compact && <span className="mbHintArrow" aria-hidden="true" />}
      </>}
      {k === "ios-other" && <>
        <b>Deschide în Safari ca s-o instalezi</b>
        <small>Pe iPhone, aplicația se poate pune pe ecranul principal doar din Safari.</small>
        <span className="mbHintBtns">
          <a className="mbBtn gold" href={`x-safari-${here}`}>Deschide în Safari</a>
          <button type="button" className="mbBtn" onClick={copy}>{copied ? "Link copiat" : "Copiază linkul"}</button>
        </span>
      </>}
      {k === "android-prompt" && <>
        <b>Instalează aplicația</b>
        <small>Se pune pe ecranul principal și se deschide fără bara browserului.</small>
        <span className="mbHintBtns"><button type="button" className="mbBtn gold" onClick={async () => { await bip!.prompt(); const c = await bip!.userChoice; if (c.outcome === "accepted") setHide(true); }}>Instalează</button></span>
      </>}
      {k === "android" && <>
        <b>Instalează aplicația</b>
        <small>Deschide meniul browserului <b>⋮</b> și alege <b>„Instalează aplicația”</b> sau <b>„Adaugă pe ecranul de pornire”</b>.</small>
      </>}
      {k === "android-inapp" && <>
        <b>Deschide în Chrome ca s-o instalezi</b>
        <small>Ești într-un browser din altă aplicație. Deschide pagina în Chrome.</small>
        <span className="mbHintBtns">
          <a className="mbBtn gold" href={`intent://${here.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`}>Deschide în Chrome</a>
          <button type="button" className="mbBtn" onClick={copy}>{copied ? "Link copiat" : "Copiază linkul"}</button>
        </span>
      </>}
    </div>
  );
}
