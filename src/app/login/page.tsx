import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Autentificare | UVALO" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ link?: string; next?: string; inchis?: string }> }) {
  const sp = await searchParams;
  // where to go after signing in (only a page of this app, e.g. the Word pane /word/anexe?mode=pdf)
  const next = sp.next && /^\/(?![/\\])[^\s\\]*$/.test(sp.next) ? sp.next : "/";
  const db = await getDb();
  if (db && (await currentSession(db))) redirect(next);
  return (
    <div className="authPage">
      <aside className="authSide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="authLockup" src="/uvalo-lockup.svg" alt="UVALO" />
        <div className="authPitch">
          <span className="authEyebrow">Platforma evaluatorilor autorizați din România</span>
          <h2>Instrumentele de evaluare, într-un singur cont.</h2>
          <ul>
            <li>Localizator cadastral: număr cadastral, topo, adresă sau locația ta pe teren</li>
            <li>Fișa imobilului cu coordonate Stereo 70 și GPS, gata de anexat</li>
            <li>Analize de piață, în curând</li>
          </ul>
        </div>
        <p className="authFine">Pentru membrii titulari ANEVAR</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="authMark" src="/uvalo-symbol.svg" alt="" aria-hidden="true" />
      </aside>
      <main className="authMain">
        <div className="authBox authCard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="authLogoSm" src="/uvalo-vertical-ink.svg" alt="UVALO" />
          <span className="authEyebrow dark">Autentificare</span>
          <h1>Bine ai revenit</h1>
          <p>Introdu adresa de email a contului tău UVALO. Îți trimitem un cod de acces, fără parolă.</p>
          {sp.inchis === "1" && <div role="status" className="note" style={{ marginBottom: 14 }}>Contul tău a fost închis. Îți mulțumim că ai folosit UVALO. Dacă revii, soliciți din nou cont cu aceeași adresă.</div>}
          <LoginForm expired={sp.link === "expired"} next={next} />
          <div className="authAlt">
            <div><b>Nu ai cont?</b><span>Este gratuit pentru membrii titulari ANEVAR: îl soliciți cu numărul legitimației.</span></div>
            <a className="btn btnGhost btnSm" href="/solicita-cont">Solicită cont gratuit →</a>
          </div>
          <p className="legalLinks"><a href="/termeni">Termeni de utilizare</a> · <a href="/confidentialitate">Confidențialitate</a></p>
        </div>
      </main>
    </div>
  );
}
