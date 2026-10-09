import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { maintenance } from "@/lib/maintenance";
import { RequestForm } from "./RequestForm";
import { getDb } from "@/lib/db";
import { referralByToken } from "@/lib/referrals";

export const metadata: Metadata = { title: "Cont gratuit pentru evaluatori | UVALO" };
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
        <img className="authLockup" src="/uvalo-lockup.svg" alt="UVALO" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="freeBadge">Gratuit</span>
          <h2>Contul UVALO este gratuit pentru evaluatorii autorizați ANEVAR.</h2>
          <ul>
            <li>Fără cost și fără date de plată</li>
            <li>Introduci numărul legitimației ANEVAR</li>
            <li>Confirmi numele din tabloul membrilor titulari</li>
            <li>Lași adresa de email; după aprobare primești linkul de activare</li>
          </ul>
        </div>
        <p style={{ fontSize: 12 }}>Datele din tablou: anevar.ro</p>
      </aside>
      <main className="authMain">
        <div className="authBox authCard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="authLogoSm" src="/uvalo-vertical-ink.svg" alt="UVALO" />
          <span className="freeBadge">Gratuit</span>
          <h1>Solicită contul tău gratuit</h1>
          <p>Durează un minut și nu costă nimic.</p>
          {ref && <div className="note"><b>{ref.by_name}</b> ți-a recomandat UVALO.</div>}
          <RequestForm r={ref ? r : undefined} email={ref?.email} />
          <p className="hint">Ai deja cont? <a className="rowLink" href="/login">Intră în cont</a></p>
        </div>
      </main>
    </div>
  );
}
