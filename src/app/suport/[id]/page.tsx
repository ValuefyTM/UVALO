import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { Composer } from "@/components/Support";
import { Chat } from "@/components/SupportChat";
import { SUPPORT_STATUS, ticket, ticketTitle } from "@/lib/support";

export const metadata: Metadata = { title: "Suport tehnic | UVALO" };
export const dynamic = "force-dynamic";

/** One conversation with the UVALO team, as a chat, with the composer at the bottom. */
export default async function SupportTicket({ params }: { params: Promise<{ id: string }> }) {
  const { db, c } = await page({ maint: true });
  const r = await ticket(db, c, Number((await params).id));
  if (!r) notFound();
  const { t, replies } = r;
  const [sl, sc] = SUPPORT_STATUS[t.status] ?? [t.status, ""];
  return (
    <AppShell c={c} active="suport" title="Suport tehnic">
      <div className="spWrap spChatWrap">
        <div className="spChatHead"><a className="spBack" href="/suport">‹ Înapoi</a><b>{ticketTitle(t)}</b><span className={`pill ${sc}`}><i />{sl}</span></div>
        <Chat t={t} replies={replies} mine={(id) => id === c.user.id} />
        {t.status === "rezolvat" && <p className="hint" style={{ textAlign: "center", margin: "0 0 8px" }}>Conversația e rezolvată. Dacă mai scrii, se redeschide.</p>}
        <Composer id={t.id} />
      </div>
    </AppShell>
  );
}
