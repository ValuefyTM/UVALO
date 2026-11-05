import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmtDate, superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { FeedbackActions } from "@/components/admin";
import { ReplyForm } from "@/components/Support";
import { SUPPORT_KINDS, SUPPORT_STATUS, ticket } from "@/lib/support";

export const metadata: Metadata = { title: "Sesizare | UVALO Admin" };
export const dynamic = "force-dynamic";

/** Admin → Feedback → a ticket: the thread, the images, the team's reply (the person gets an email), status and internal note. */
export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const { db, c, pending } = await superPage();
  const r = await ticket(db, c, Number((await params).id), { admin: true });
  if (!r) notFound();
  const { t, replies } = r;
  const [sl, sc] = SUPPORT_STATUS[t.status] ?? [t.status, ""];
  return (
    <AdminShell c={c} active="feedback" pending={pending} title={`Sesizarea #${t.id}`} subtitle={`${SUPPORT_KINDS[t.kind] ?? t.kind} · ${fmtDate(t.created_at, true)}`}>
      <div className="actions" style={{ justifyContent: "flex-start" }}><a className="btn btnSm btnGhost" href="/admin/feedback">‹ Toate sesizările</a></div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 18, alignItems: "start" }}>
        <section className="card">
          <div className="spHead"><h2 style={{ margin: 0, fontSize: 16 }}>Conversația</h2><span className={`pill ${sc}`}><i />{sl}</span></div>
          <div className="spThread">
            <div className="spMsg">
              <div className="spBubble">{t.text}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.image_key && <a href={`/api/suport/img/f/${t.id}`} target="_blank" rel="noopener"><img className="spImg" src={`/api/suport/img/f/${t.id}`} alt="Imaginea atașată sesizării" /></a>}
              <small>{t.who ?? "—"} · {fmtDate(t.created_at, true)}{t.page ? ` · din ${t.page}` : ""}</small>
            </div>
            {replies.map((m) => (
              <div key={m.id} className={`spMsg${m.staff ? " staff" : ""}`}>
                <div className="spBubble">{m.text}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.image_key && <a href={`/api/suport/img/r/${m.id}`} target="_blank" rel="noopener"><img className="spImg" src={`/api/suport/img/r/${m.id}`} alt="Imagine atașată" /></a>}
                <small>{m.staff ? `Echipa UVALO (${m.who ?? ""})` : t.who ?? "—"} · {fmtDate(m.created_at, true)}</small>
              </div>
            ))}
          </div>
          <h3 style={{ margin: "8px 0 0", fontSize: 14 }}>Răspunde</h3>
          <ReplyForm id={t.id} staff />
        </section>
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 15 }}>De la</h2>
          {t.user_id ? <a className="rowLink" href={`/admin/activitate?user=${t.user_id}`}><b>{t.who}</b></a> : <b>—</b>}
          <span className="muted">{t.email}{t.org ? ` · ${t.org}` : ""}</span>
          <span className="muted" style={{ fontSize: 12 }}>{t.contact ? "Acceptă răspuns pe email" : "Nu vrea răspuns pe email (primește răspunsul doar în platformă)"}</span>
          <div style={{ borderTop: "1px solid var(--divider)", paddingTop: 10 }}><FeedbackActions id={t.id} status={t.status} email={t.contact ? t.email : null} note={t.note} /></div>
        </section>
      </div>
    </AdminShell>
  );
}
