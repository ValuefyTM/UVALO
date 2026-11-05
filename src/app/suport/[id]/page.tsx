import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmtDate, page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { ReplyForm } from "@/components/Support";
import { SUPPORT_KINDS, SUPPORT_STATUS, ticket } from "@/lib/support";

export const metadata: Metadata = { title: "Sesizare | UVALO" };
export const dynamic = "force-dynamic";

/** One ticket of the person: the thread with the UVALO team, the images, a reply. */
export default async function SupportTicket({ params }: { params: Promise<{ id: string }> }) {
  const { db, c } = await page({ maint: true });
  const r = await ticket(db, c, Number((await params).id));
  if (!r) notFound();
  const { t, replies } = r;
  const [sl, sc] = SUPPORT_STATUS[t.status] ?? [t.status, ""];
  return (
    <AppShell c={c} active="suport" title={`Sesizarea #${t.id}`} subtitle={`${SUPPORT_KINDS[t.kind] ?? t.kind} · trimisă ${fmtDate(t.created_at, true)}`} actions={<a className="btn btnGhost" href="/suport">‹ Toate sesizările</a>}>
      <div style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 18 }}>
        <section className="card">
          <div className="spHead"><h2 style={{ margin: 0, fontSize: 16 }}>Conversația</h2><span className={`pill ${sc}`}><i />{sl}</span></div>
          <div className="spThread">
            <div className="spMsg">
              <div className="spBubble">{t.text}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.image_key && <a href={`/api/suport/img/f/${t.id}`} target="_blank" rel="noopener"><img className="spImg" src={`/api/suport/img/f/${t.id}`} alt="Imaginea atașată sesizării" /></a>}
              <small>Tu · {fmtDate(t.created_at, true)}{t.page && t.page !== "/suport" ? ` · din ${t.page}` : ""}</small>
            </div>
            {replies.map((m) => (
              <div key={m.id} className={`spMsg${m.staff ? " staff" : ""}`}>
                <div className="spBubble">{m.text}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.image_key && <a href={`/api/suport/img/r/${m.id}`} target="_blank" rel="noopener"><img className="spImg" src={`/api/suport/img/r/${m.id}`} alt="Imagine atașată" /></a>}
                <small>{m.staff ? "Echipa UVALO" : "Tu"} · {fmtDate(m.created_at, true)}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 16 }}>{t.status === "rezolvat" ? "Mai ai ceva de adăugat? Sesizarea se redeschide." : "Scrie înapoi"}</h2>
          <ReplyForm id={t.id} />
        </section>
      </div>
    </AppShell>
  );
}
