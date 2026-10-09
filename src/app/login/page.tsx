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
        <img src="/uvalo-logo.svg" alt="UVALO" style={{ position: "relative", height: 30, width: "auto", alignSelf: "flex-start", display: "block" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="eyebrow" style={{ position: "relative", color: "var(--acc-light)" }}>UVALO</span>
          <h2>Instrumente pentru evaluatori, într-un singur cont.</h2>
          <p>Localizator cadastral, pe teren și la birou. În curând: analize de piață.</p>
        </div>
        <p style={{ fontSize: 12 }}>Pentru membrii titulari ANEVAR</p>
      </aside>
      <main className="authMain">
        <div className="authBox">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="authLogoSm" src="/uvalo-logo-ink.svg" alt="UVALO" />
          <h1>Intră în UVALO</h1>
          <p>Introdu adresa de email a contului tău.</p>
          <LoginForm expired={(await searchParams).link === "expired"} />
          <div className="note" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <b>Nu ai cont?</b>
            <span>Dacă ești membru titular ANEVAR, solicită un cont cu numărul legitimației.</span>
            <a className="btn btnGhost" href="/solicita-cont" style={{ alignSelf: "flex-start" }}>Solicită cont →</a>
          </div>
        </div>
      </main>
    </div>
  );
}
