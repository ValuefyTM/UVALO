import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmtDate, superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { FeedbackActions } from "@/components/admin";
import { Composer } from "@/components/Support";
import { Chat } from "@/components/SupportChat";
import { SUPPORT_KINDS, SUPPORT_STATUS, ticket, ticketTitle } from "@/lib/support";

export const metadata: Metadata = { title: "Sesizare | UVALO Admin" };
export const dynamic = "force-dynamic";

/** Admin → Feedback → a ticket: the chat with the person (the team's bubbles on the right), the reply composer, status and internal note. */
export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const { db, c, pending } = await superPage();
  const r = await ticket(db, c, Number((await params).id), { admin: true });
  if (!r) notFound();
  const { t, replies } = r;
  const [sl, sc] = SUPPORT_STATUS[t.status] ?? [t.status, ""];
  return (
    <AdminShell c={c} active="feedback" pending={pending} title={ticketTitle(t)} subtitle={`#${t.id} · ${SUPPORT_KINDS[t.kind] ?? t.kind} · ${fmtDate(t.created_at, true)}${t.page ? ` · din ${t.page}` : ""}`}>
      <div className="actions" style={{ justifyContent: "flex-start" }}><a className="btn btnSm btnGhost" href="/admin/feedback">‹ Toate sesizările</a></div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 18, alignItems: "start" }}>
        <section className="card" style={{ gap: 8 }}>
          <div className="spChatHead" style={{ padding: 0 }}><b>Conversația</b><span className={`pill ${sc}`}><i />{sl}</span></div>
          <Chat t={t} replies={replies} mine={() => false} names />
          <Composer id={t.id} staff />
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
