import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { maintenance } from "@/lib/maintenance";
import { RequestForm } from "./RequestForm";
import { getDb } from "@/lib/db";
import { referralByToken } from "@/lib/referrals";

export const metadata: Metadata = { title: "Solicită cont | UVALO" };
export const dynamic = "force-dynamic";

export default async function RequestAccount({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const mdb = await getDb();
  if (mdb && (await maintenance(mdb)).on) redirect("/mentenanta");
  // Opened from a colleague's recommendation: we say who recommended and keep the link with the request.
  const { r } = await searchParams;
  const db = r ? await getDb() : null;
  const ref = db ? await referralByToken(db, r) : null;
  return (
    <div className="authPage">
      <aside className="authSide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/uvalo-logo.svg" alt="UVALO" style={{ position: "relative", height: 30, width: "auto", alignSelf: "flex-start", display: "block" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="eyebrow" style={{ position: "relative", color: "var(--acc-light)" }}>UVALO</span>
          <h2>Cont pentru evaluatorii autorizați ANEVAR.</h2>
          <ul>
            <li>Introduci numărul legitimației ANEVAR</li>
            <li>Confirmi numele din tabloul membrilor titulari</li>
            <li>Lași adresa de email; după aprobare primești linkul de activare</li>
          </ul>
        </div>
        <p style={{ fontSize: 12 }}>Datele din tablou: anevar.ro</p>
      </aside>
      <main className="authMain">
        <div className="authBox">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="authLogoSm" src="/uvalo-logo-ink.svg" alt="UVALO" />
          <h1>Solicită cont</h1>
          {ref && <div className="note"><b>{ref.by_name}</b> ți-a recomandat UVALO.</div>}
          <RequestForm r={ref ? r : undefined} email={ref?.email} />
          <p className="hint">Ai deja cont? <a className="rowLink" href="/login">Intră în cont</a></p>
        </div>
      </main>
    </div>
  );
}
