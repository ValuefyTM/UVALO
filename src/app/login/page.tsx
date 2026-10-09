import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Autentificare | UVALO" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const db = await getDb();
  if (db && (await currentSession(db))) redirect("/");
  return (
    <div className="authPage">
      <aside className="authSide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="authLockup" src="/uvalo-lockup.svg" alt="UVALO" />
        <div className="authPitch">
          <span className="authEyebrow">Platformă pentru evaluatori</span>
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
          <LoginForm expired={(await searchParams).link === "expired"} />
          <div className="authAlt">
            <div><b>Nu ai cont?</b><span>Membrii titulari ANEVAR îl solicită cu numărul legitimației.</span></div>
            <a className="btn btnGhost btnSm" href="/solicita-cont">Solicită cont →</a>
          </div>
        </div>
      </main>
    </div>
  );
}
