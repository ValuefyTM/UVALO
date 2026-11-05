import type { Metadata } from "next";
import { fmtDate, page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { myTickets, SUPPORT_STATUS, ticketTitle } from "@/lib/support";

export const metadata: Metadata = { title: "Suport tehnic | UVALO" };
export const dynamic = "force-dynamic";

const when = (iso: string) => {
  const d = new Date(iso), today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" }) === today ? d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }) : fmtDate(iso, true);
};

/** Suport tehnic: the person's conversations with the UVALO team and „+ Tichet nou”. */
export default async function Support() {
  const { db, c } = await page({ maint: true });
  const rows = await myTickets(db, c.user.id);
  return (
    <AppShell c={c} active="suport" title="Suport tehnic">
      <div className="spWrap">
        <h2 className="spCap">Conversațiile mele</h2>
        {rows.length === 0 ? <p className="hint" style={{ marginBottom: 14 }}>Nu ai nicio conversație încă. Scrie-ne ce nu merge sau ce ai vrea; mesajele din butonul de feedback (dreapta jos) ajung tot aici.</p> : (
          <div className="spList">
            {rows.map((t) => { const [sl, sc] = SUPPORT_STATUS[t.status] ?? [t.status, ""]; return (
              <a key={t.id} className={`spRow${t.unread ? " unread" : ""}`} href={`/suport/${t.id}`}>
                <span className="spRowIco" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg></span>
                <span className="spRowText"><b>{ticketTitle(t)}</b><small>{when(t.updated_at ?? t.created_at)}{t.replies ? ` · ${t.replies} ${t.replies === 1 ? "răspuns" : "mesaje"}` : ""}</small></span>
                <span className={`pill ${t.unread ? "pillWarn" : sc}`}><i />{t.unread ? "Răspuns nou" : sl}</span>
                <span className="spRowGo" aria-hidden="true">›</span>
              </a>); })}
          </div>
        )}
        <p className="hint" style={{ margin: "14px 0" }}>Răspunsul apare aici și pe email.</p>
        <a className="btn btnPri spBig" href="/suport/nou"><span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Tichet nou</a>
      </div>
    </AppShell>
  );
}
