import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { maintenance } from "@/lib/maintenance";
import { getDb } from "@/lib/db";
import { inviteByToken } from "@/lib/auth";
import { AcceptForm } from "./AcceptForm";

export const metadata: Metadata = { title: "Invitație | UVALO" };
export const dynamic = "force-dynamic";

export default async function Invitation({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const mdb = await getDb();
  if (mdb && (await maintenance(mdb)).on) redirect("/mentenanta");
  const token = (await searchParams).token ?? "";
  const db = await getDb();
  const inv = db && token ? await inviteByToken(db, token) : null;
  return (
    <div className="authPage">
      <aside className="authSide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/uvalo-logo.svg" alt="UVALO" style={{ position: "relative", height: 30, width: "auto", alignSelf: "flex-start", display: "block" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="eyebrow" style={{ position: "relative", color: "var(--acc-light)" }}>UVALO</span>
          <h2>{inv?.org_name ? `Bine ai venit în contul ${inv.org_name}.` : "Bine ai venit în UVALO."}</h2>
          <p>Activează-ți contul în mai puțin de un minut. Nu folosim parole: te autentifici cu un cod primit pe email.</p>
        </div>
        <p style={{ fontSize: 12 }}>Firmă autorizată ANEVAR</p>
      </aside>
      <main className="authMain">
        <div className="authBox">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="authLogoSm" src="/uvalo-logo-ink.svg" alt="UVALO" />
          {inv ? (
            <>
              <h1>Activează contul</h1>
              <p>Contul <b>{inv.email}</b>{inv.org_name ? <> · firma <b>{inv.org_name}</b></> : null}</p>
              <AcceptForm token={token} name={inv.name} phone={inv.phone ?? ""} legit={inv.anevar_no} county={inv.county} />
            </>
          ) : (
            <>
              <h1>Invitația nu mai este valabilă</h1>
              <p>A expirat sau a fost deja folosită. Dacă ai activat deja contul, <a className="rowLink" href="/login">intră cu adresa de email</a>; altfel, cere o invitație nouă celui care te-a invitat.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
