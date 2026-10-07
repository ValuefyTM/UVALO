import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Autentificare | VALUEFY Tools" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const db = await getDb();
  if (db && (await currentSession(db))) redirect("/");
  return (
    <div className="authPage">
      <aside className="authSide">
        <span className="brandPill" style={{ position: "relative", alignSelf: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/valuefy-logo.png" alt="VALUEFY" style={{ height: 22, display: "block" }} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="eyebrow" style={{ position: "relative", color: "var(--acc-light)" }}>VALUEFY TOOLS</span>
          <h2>Instrumente pentru evaluatori, într-un singur cont.</h2>
          <p>Localizare cadastrală ANCPI pe teren și la birou. În curând: analize de piață.</p>
        </div>
        <p style={{ fontSize: 12 }}>Acces pe bază de invitație</p>
      </aside>
      <main className="authMain">
        <div className="authBox">
          <h1>Intră în VALUEFY Tools</h1>
          <p>Introdu adresa de email cu care ai fost invitat(ă).</p>
          <LoginForm expired={(await searchParams).link === "expired"} />
        </div>
      </main>
    </div>
  );
}
