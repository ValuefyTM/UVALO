"use client";

import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Instalează pe calculator" in the side menu: shown only when the browser offers the install (beforeinstallprompt: Chrome / Edge, not yet installed). */
export function AppInstall() {
  const [ev, setEv] = useState<BIP | null>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEv(e as BIP); };
    const done = () => setEv(null);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);
  if (!ev) return null;
  return (
    <button type="button" className="logout appInstall" onClick={async () => { await ev.prompt(); if ((await ev.userChoice).outcome === "accepted") setEv(null); }}
      title="UVALO ca aplicație pe calculator: fereastră proprie, pictogramă în bara de aplicații">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M12 7v6M9.5 10.5 12 13l2.5-2.5" /></svg>
      Instalează pe calculator
    </button>
  );
}
