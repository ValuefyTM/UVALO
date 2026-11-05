import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { FeedbackActions } from "@/components/admin";
import { SUPPORT_KINDS } from "@/lib/support";

export const metadata: Metadata = { title: "Feedback | UVALO Admin" };
export const dynamic = "force-dynamic";

const KIND_CLS: Record<string, string> = { problema: "pillErr", idee: "pillOk", altceva: "" };
const FILTERS: [string, string][] = [["", "De rezolvat"], ["nou", "Noi"], ["rezolvat", "Rezolvate"], ["toate", "Toate"]];

/** The tickets (feedback button + Suport tehnic), newest activity first; „Deschide” = the thread with the person. */
export default async function Feedback({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { db, c, pending } = await superPage();
  const s = (await searchParams).s ?? "";
  const where = s === "nou" ? "f.status = 'nou'" : s === "rezolvat" ? "f.status = 'rezolvat'" : s === "toate" ? "1 = 1" : "f.status <> 'rezolvat'";
  const [{ results }, counts] = await Promise.all([
    db.prepare(`SELECT f.*, COALESCE(NULLIF(u.name, ''), u.email) AS who, u.email, o.name AS org,
        (SELECT COUNT(*) FROM feedback_replies r WHERE r.feedback_id = f.id) AS replies
      FROM feedback f LEFT JOIN users u ON u.id = f.user_id LEFT JOIN orgs o ON o.id = f.org_id
      WHERE ${where} ORDER BY COALESCE(f.updated_at, f.created_at) DESC LIMIT 300`)
      .all<{ id: number; user_id: string | null; kind: string; text: string; page: string | null; contact: number; status: string; note: string | null; image_key: string | null; created_at: string; updated_at: string | null; who: string | null; email: string | null; org: string | null; replies: number }>(),
    db.prepare("SELECT SUM(status = 'nou') AS nou, SUM(status <> 'rezolvat') AS open, COUNT(*) AS n FROM feedback").first<{ nou: number | null; open: number | null; n: number }>(),
  ]);
  return (
    <AdminShell c={c} active="feedback" pending={pending} title="Feedback" subtitle={`${counts?.nou ?? 0} noi · ${counts?.open ?? 0} de rezolvat · ${counts?.n ?? 0} în total`}>
      <div className="actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        {FILTERS.map(([v, l]) => <a key={v} className={`btn btnSm ${s === v ? "btnNavy" : "btnGhost"}`} href={v ? `/admin/feedback?s=${v}` : "/admin/feedback"}>{l}</a>)}
        <a className="btn btnSm btnGhost" href="/admin/feedback/chestionar" style={{ marginLeft: "auto" }}>Chestionarul de feedback →</a>
      </div>
      {results.length === 0 ? <section className="card"><p className="hint">Niciun mesaj aici.</p></section> : (
        <section className="card flush">
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Sesizare</th><th>De la</th><th>Când</th><th /></tr></thead>
              <tbody>
                {results.map((f) => (
                  <tr key={f.id} style={f.status === "nou" ? { background: "#fffaf2" } : undefined}>
                    <td style={{ maxWidth: 560 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        <span className={`pill ${KIND_CLS[f.kind] ?? ""}`}><i />{SUPPORT_KINDS[f.kind] ?? f.kind}</span>
                        {f.image_key && <span className="pill">cu imagine</span>}
                        {f.replies > 0 && <span className="pill">{f.replies} {f.replies === 1 ? "mesaj" : "mesaje"}</span>}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{f.text.length > 400 ? `${f.text.slice(0, 400)}…` : f.text}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        <a className="rowLink" href={`/admin/feedback/${f.id}`}><b>Deschide și răspunde →</b></a>
                        {f.page && <> · din <a className="rowLink" href={f.page}>{f.page}</a></>}
                      </div>
                    </td>
                    <td>
                      {f.user_id ? <a className="rowLink" href={`/admin/activitate?user=${f.user_id}`}><b className="block">{f.who}</b></a> : <b className="block">—</b>}
                      <span className="muted">{f.email}{f.org ? ` · ${f.org}` : ""}</span>
                      <div className="muted" style={{ fontSize: 12 }}>{f.contact ? "Acceptă răspuns pe email" : "Nu vrea răspuns pe email"}</div>
                    </td>
                    <td className="mono">{fmtDate(f.updated_at ?? f.created_at, true)}</td>
                    <td className="r"><FeedbackActions id={f.id} status={f.status} email={f.contact ? f.email : null} note={f.note} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
