import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { FeedbackActions } from "@/components/admin";

export const metadata: Metadata = { title: "Feedback | UVALO Admin" };
export const dynamic = "force-dynamic";

const KIND: Record<string, [string, string]> = { problema: ["Problemă", "pillErr"], idee: ["Idee", "pillOk"], altceva: ["Altceva", ""] };
const FILTERS: [string, string][] = [["", "De rezolvat"], ["nou", "Noi"], ["rezolvat", "Rezolvate"], ["toate", "Toate"]];

/** Messages from the floating feedback button, newest first. */
export default async function Feedback({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { db, c, pending } = await superPage();
  const s = (await searchParams).s ?? "";
  const where = s === "nou" ? "f.status = 'nou'" : s === "rezolvat" ? "f.status = 'rezolvat'" : s === "toate" ? "1 = 1" : "f.status <> 'rezolvat'";
  const [{ results }, counts] = await Promise.all([
    db.prepare(`SELECT f.*, COALESCE(NULLIF(u.name, ''), u.email) AS who, u.email, o.name AS org FROM feedback f LEFT JOIN users u ON u.id = f.user_id LEFT JOIN orgs o ON o.id = f.org_id
      WHERE ${where} ORDER BY f.id DESC LIMIT 300`)
      .all<{ id: number; user_id: string | null; kind: string; text: string; page: string | null; contact: number; status: string; note: string | null; created_at: string; who: string | null; email: string | null; org: string | null }>(),
    db.prepare("SELECT SUM(status = 'nou') AS nou, SUM(status <> 'rezolvat') AS open, COUNT(*) AS n FROM feedback").first<{ nou: number | null; open: number | null; n: number }>(),
  ]);
  return (
    <AdminShell c={c} active="feedback" pending={pending} title="Feedback" subtitle={`${counts?.nou ?? 0} noi · ${counts?.open ?? 0} de rezolvat · ${counts?.n ?? 0} în total`}>
      <div className="actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        {FILTERS.map(([v, l]) => <a key={v} className={`btn btnSm ${s === v ? "btnNavy" : "btnGhost"}`} href={v ? `/admin/feedback?s=${v}` : "/admin/feedback"}>{l}</a>)}
      </div>
      {results.length === 0 ? <section className="card"><p className="hint">Niciun mesaj aici.</p></section> : (
        <section className="card flush">
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Mesaj</th><th>De la</th><th>Când</th><th /></tr></thead>
              <tbody>
                {results.map((f) => {
                  const [kl, kc] = KIND[f.kind] ?? [f.kind, ""];
                  return (
                    <tr key={f.id} style={f.status === "nou" ? { background: "#fffaf2" } : undefined}>
                      <td style={{ maxWidth: 560 }}>
                        <span className={`pill ${kc}`} style={{ marginBottom: 6 }}><i />{kl}</span>
                        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{f.text}</div>
                        {f.page && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>din <a className="rowLink" href={f.page}>{f.page}</a></div>}
                      </td>
                      <td>
                        {f.user_id ? <a className="rowLink" href={`/admin/activitate?user=${f.user_id}`}><b className="block">{f.who}</b></a> : <b className="block">—</b>}
                        <span className="muted">{f.email}{f.org ? ` · ${f.org}` : ""}</span>
                        <div className="muted" style={{ fontSize: 12 }}>{f.contact ? "Acceptă răspuns pe email" : "Nu vrea răspuns pe email"}</div>
                      </td>
                      <td className="mono">{fmtDate(f.created_at, true)}</td>
                      <td className="r"><FeedbackActions id={f.id} status={f.status} email={f.contact ? f.email : null} note={f.note} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
