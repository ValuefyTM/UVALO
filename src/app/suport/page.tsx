import type { Metadata } from "next";
import { fmtDate, page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { TicketForm } from "@/components/Support";
import { myTickets, SUPPORT_KINDS, SUPPORT_STATUS } from "@/lib/support";

export const metadata: Metadata = { title: "Suport tehnic | UVALO" };
export const dynamic = "force-dynamic";

/** Suport tehnic: the person's tickets (with the team's answers) and a new one, with a screenshot. */
export default async function Support() {
  const { db, c } = await page({ maint: true });
  const rows = await myTickets(db, c.user.id);
  const open = rows.filter((t) => t.status !== "rezolvat"), closed = rows.filter((t) => t.status === "rezolvat");
  const Row = ({ t }: { t: (typeof rows)[number] }) => {
    const [sl, sc] = SUPPORT_STATUS[t.status] ?? [t.status, ""];
    return (
      <a className={`spRow${t.unread ? " unread" : ""}`} href={`/suport/${t.id}`}>
        <b>{t.text.split("\n")[0]}</b>
        <span className={`pill ${sc}`}><i />{t.unread ? "Răspuns nou" : sl}</span>
        <small>{SUPPORT_KINDS[t.kind] ?? t.kind} · #{t.id} · {fmtDate(t.updated_at ?? t.created_at, true)}{t.replies ? ` · ${t.replies} ${t.replies === 1 ? "mesaj" : "mesaje"}` : ""}{t.image_key ? " · cu imagine" : ""}</small>
      </a>
    );
  };
  return (
    <AppShell c={c} active="suport" title="Suport tehnic" subtitle="Scrie-ne ce nu merge sau ce ai vrea; răspundem aici și pe email.">
      <div style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 18 }}>
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 16 }}>Sesizare nouă</h2>
          <TicketForm />
        </section>
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 16 }}>Sesizările tale{open.length ? ` · ${open.length} ${open.length === 1 ? "deschisă" : "deschise"}` : ""}</h2>
          {rows.length === 0 ? <p className="hint">Nu ai trimis nicio sesizare încă. Mesajele trimise din butonul de feedback (dreapta jos) apar tot aici.</p> : (
            <div className="spList">
              {open.map((t) => <Row key={t.id} t={t} />)}
              {closed.length > 0 && <>
                <small className="hint" style={{ marginTop: 6 }}>Rezolvate</small>
                {closed.map((t) => <Row key={t.id} t={t} />)}
              </>}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
