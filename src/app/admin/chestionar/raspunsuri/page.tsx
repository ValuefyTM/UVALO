import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { SurveyNav } from "@/components/SurveyNav";
import { surveyLines, surveyRows, surveySettings } from "@/lib/survey";

export const metadata: Metadata = { title: "Chestionar · răspunsurile | UVALO Admin" };
export const dynamic = "force-dynamic";

/** Admin → Chestionar → Răspunsurile: every person, with the note, the reason and all the answers folded. */
export default async function SurveyRowsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { db, c, pending } = await superPage();
  const s = await surveySettings(db);
  const id = (await searchParams).id || s.id;
  const rows = await surveyRows(db, id);
  const { results: older } = await db.prepare("SELECT survey_id AS id, COUNT(*) AS n, SUM(done_at IS NOT NULL) AS d FROM survey_answers GROUP BY survey_id ORDER BY MAX(created_at) DESC").all<{ id: string; n: number; d: number }>();
  const done = rows.filter((r) => r.done_at).length;
  return (
    <AdminShell c={c} active="chestionar" pending={pending} title="Chestionarul de feedback" subtitle={`${id} · ${rows.length} persoane au deschis chestionarul · ${done} l-au completat`}
      actions={<a className="btn btnGhost btnSm" href={`/api/admin/survey?csv=1${id === s.id ? "" : `&id=${encodeURIComponent(id)}`}`}>Exportă CSV</a>}>
      <SurveyNav page="rows" id={id} activeId={s.id} older={older} />
      <section className="card flush">
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Când</th><th>Cine</th><th>Nota</th><th>Răspunsurile</th><th>Sună-mă</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const nps = typeof r.answers.nps === "number" ? r.answers.nps : null;
                const lines = surveyLines(r.answers, s.wants);
                return (
                  <tr key={r.id}>
                    <td className="mono">{fmtDate(r.updated_at, true)}<div className="muted" style={{ fontSize: 11 }}>{r.done_at ? "complet" : `pasul ${r.step} din 5`}</div></td>
                    <td><a className="rowLink" href={`/admin/activitate?user=${r.user_id}`}><b className="block">{r.who}</b></a><span className="muted" style={{ fontSize: 12 }}>{r.email}{r.org ? ` · ${r.org}` : ""} · {r.actions} acțiuni</span></td>
                    <td>{nps === null ? "—" : <span className={`pill ${nps >= 9 ? "pillWarn" : nps <= 6 ? "pillErr" : ""}`}>{nps}</span>}</td>
                    <td style={{ maxWidth: 560 }}>
                      {r.answers.why ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, marginBottom: 6 }}>{String(r.answers.why)}</div> : null}
                      <details style={{ fontSize: 12 }}><summary className="muted">Toate răspunsurile</summary>
                        <table style={{ marginTop: 6, fontSize: 12 }}><tbody>{lines.map(([k, v]) => <tr key={k}><td className="muted" style={{ padding: "2px 10px 2px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td><td style={{ padding: "2px 0" }}>{v}</td></tr>)}</tbody></table>
                      </details>
                    </td>
                    <td>{r.answers.call === "yes" ? <span className="pill pillOk"><i />{String(r.answers.phone || "da")}</span> : <span className="muted">nu acum</span>}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={5} className="muted" style={{ padding: 18 }}>Nimeni nu a deschis încă acest chestionar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
