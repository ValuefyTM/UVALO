import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { context, MODULES } from "@/lib/access";
import { checkAuthorize } from "@/lib/oauth";

export const metadata: Metadata = { title: "Permite accesul | UVALO", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The consent page of the OAuth flow (Claude → "sign in to UVALO"): who asks, for whom, what it gets; works in maintenance too. */
export default async function Authorize({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const db = await getDb();
  if (!db) throw new Error("Baza de date nu este disponibilă.");
  const c = await context(db);
  if (!c) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${q}`)}`);
  const a = await checkAuthorize(db, q);
  const name = "error" in a ? "" : a.client.name || "Aplicația";
  const scopes = "error" in a ? [] : a.scope.split(" ").map((s) => MODULES.find((m) => m.key === s)?.name ?? s);
  const has = "error" in a ? [] : a.scope.split(" ").filter((s) => !c.modules.includes(s));
  return (
    <div className="authPage">
      <aside className="authSide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="authLockup" src="/uvalo-lockup.svg" alt="UVALO" />
        <div className="authPitch">
          <span className="authEyebrow">UVALO în Claude</span>
          <h2>Datele din localizator, direct în conversație.</h2>
          <ul>
            <li>Imobile după numărul cadastral, coordonate sau adresă</li>
            <li>Contur, construcții, vecini, zona de impozitare, grila notarială 2026</li>
            <li>Accesul se poate opri oricând din „Contul meu”</li>
          </ul>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="authMark" src="/uvalo-symbol.svg" alt="" aria-hidden="true" />
      </aside>
      <main className="authMain">
        <div className="authBox authCard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="authLogoSm" src="/uvalo-vertical-ink.svg" alt="UVALO" />
          <span className="authEyebrow dark">Permite accesul</span>
          {"error" in a ? (
            <>
              <h1>Nu putem continua</h1>
              <p>{a.error}</p>
              <a className="btn btnGhost" href="/">Înapoi la UVALO</a>
            </>
          ) : (
            <>
              <h1>{name} vrea să folosească contul tău UVALO</h1>
              <p>Ești autentificat ca <b>{c.user.name || c.user.email}</b>{c.org ? ` (${c.org.name})` : ""}. Aplicația va putea folosi, în numele tău:</p>
              <ul className="oaScopes">{scopes.map((s) => <li key={s}>{s}</li>)}</ul>
              {has.length > 0 && <div className="note">Planul tău nu cuprinde acum {has.map((s) => MODULES.find((m) => m.key === s)?.name ?? s).join(", ")}: aplicația se conectează, dar aceste instrumente vor răspunde „fără acces”.</div>}
              <form method="post" action="/api/oauth/authorize" className="oaForm">
                {[...q.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <button type="submit" name="decision" value="allow" className="btn btnGold">Permite</button>
                <button type="submit" name="decision" value="deny" className="btn btnGhost">Refuză</button>
              </form>
              <p className="authFine dark">Accesul rămâne activ până îl oprești din „Contul meu” → „UVALO în Claude” sau până expiră (30 de zile fără reînnoire).
                Nu ești tu? <a href={`/login?next=${encodeURIComponent(`/oauth/authorize?${q}`)}`}>Schimbă contul</a>.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
