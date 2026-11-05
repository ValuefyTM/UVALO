import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { SurveyAdmin } from "@/components/SurveyAdmin";
import { surveyLines, surveyRows, surveySettings, surveyStats } from "@/lib/survey";

export const metadata: Metadata = { title: "Chestionar | UVALO Admin" };
export const dynamic = "force-dynamic";

const Bar = ({ label, n, max, sub, grey }: { label: string; n: number | string; max: number; sub?: string; grey?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
    <span style={{ width: 200, flex: "none", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>{label}</span>
    <i style={{ display: "block", height: 14, borderRadius: 4, background: grey ? "#C9C1B5" : "var(--acc)", width: `${max > 0 ? Math.max(2, (Number(n) / max) * 100) : 2}%`, maxWidth: 220 }} />
    <b style={{ minWidth: 34, textAlign: "right" }}>{n}</b>{sub && <small className="muted" style={{ whiteSpace: "nowrap" }}>{sub}</small>}
  </div>
);

/** Admin → Feedback → Chestionar: settings, the figures (NPS, tools, wants, price…) and every answer. */
export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { db, c, pending } = await superPage();
  const s = await surveySettings(db);
  const id = (await searchParams).id || s.id;
  const rows = await surveyRows(db, id);
  const st = surveyStats(rows, s.wants);
  const { results: older } = await db.prepare("SELECT survey_id AS id, COUNT(*) AS n, SUM(done_at IS NOT NULL) AS d FROM survey_answers GROUP BY survey_id ORDER BY MAX(created_at) DESC").all<{ id: string; n: number; d: number }>();
  const eligible = (await db.prepare("SELECT COUNT(*) AS n FROM (SELECT user_id FROM events e JOIN users u ON u.id = e.user_id AND u.status = 'active' AND u.is_superadmin = 0 GROUP BY user_id HAVING COUNT(*) >= ?)").bind(s.min_actions).first<{ n: number }>())?.n ?? 0;
  const maxW = Math.max(1, ...st.wants.map((w) => w.pts));
  const Dist = ({ title, items }: { title: string; items: { label: string; n: number }[] }) => {
    const m = Math.max(1, ...items.map((i) => i.n));
    return <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><h3 style={{ margin: "4px 0 2px", fontSize: 13 }}>{title}</h3>{items.map((i) => <Bar key={i.label} label={i.label} n={i.n} max={m} />)}</div>;
  };
  return (
    <AdminShell c={c} active="feedback" pending={pending} title="Chestionarul de feedback" subtitle={`${id} · ${st.done} răspunsuri complete · ${eligible} conturi eligibile acum`}>
      <div className="actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <a className="btn btnSm btnGhost" href="/admin/feedback">‹ Sesizări</a>
        {older.filter((o) => o.id !== s.id).map((o) => <a key={o.id} className={`btn btnSm ${id === o.id ? "btnNavy" : "btnGhost"}`} href={`/admin/feedback/chestionar?id=${o.id}`}>{o.id} · {o.d}</a>)}
        {id !== s.id && <a className="btn btnSm btnGhost" href="/admin/feedback/chestionar">Chestionarul activ · {s.id}</a>}
      </div>
      {id === s.id && <section className="card"><h2 style={{ margin: 0, fontSize: 16 }}>Chestionarul activ <span className={`pill ${s.on ? "pillOk" : ""}`} style={{ marginLeft: 8 }}><i />{s.on ? "se afișează" : "oprit"}</span></h2><SurveyAdmin s={s} /></section>}

      <div className="kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div className="card kpi"><b style={{ fontSize: 26 }}>{st.done}</b><small>răspunsuri complete · {st.partial} începute, {st.opened} doar deschise</small></div>
        <div className="card kpi"><b style={{ fontSize: 26, color: st.nps === null ? undefined : st.nps >= 0 ? "var(--ok-text)" : "var(--err)" }}>{st.nps === null ? "—" : `${st.nps > 0 ? "+" : ""}${st.nps}`}</b><small>NPS · {st.prom}% promotori, {st.det}% detractori</small></div>
        <div className="card kpi"><b style={{ fontSize: 26 }}>{st.avg === null ? "—" : st.avg.toFixed(1).replace(".", ",")}</b><small>nota medie a instrumentelor (1–5)</small></div>
        <div className="card kpi"><b style={{ fontSize: 26 }}>{st.calls}</b><small>vor să fie sunați</small></div>
        <div className="card kpi"><b style={{ fontSize: 26 }}>{st.price.slice().sort((a, b) => b.n - a.n)[0]?.n ? st.price.slice().sort((a, b) => b.n - a.n)[0].label : "—"}</b><small>intervalul de preț cel mai ales</small></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <section className="card" style={{ gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Ce le-ar fi util <small className="muted" style={{ fontWeight: 500 }}>· ponderat: locul 1 = 3 p, 2 = 2 p, 3 = 1 p</small></h2>
          {st.wants.map((w) => <Bar key={w.label} label={w.label} n={w.pts} max={maxW} sub={`${w.n} pers.`} />)}
          {st.other.length > 0 && <details style={{ fontSize: 12.5 }}><summary>Altceva · {st.other.length}</summary><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{st.other.map((o, i) => <li key={i}>{o}</li>)}</ul></details>}
        </section>
        <section className="card" style={{ gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Nota pe instrument <small className="muted" style={{ fontWeight: 500 }}>· media și câți l-au notat</small></h2>
          {st.tools.slice().sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)).map((t) => <Bar key={t.key} label={t.label} n={t.avg === null ? "—" : t.avg.toFixed(1).replace(".", ",")} max={5} sub={`${t.n}`} grey={t.avg === null} />)}
          <h3 style={{ margin: "8px 0 2px", fontSize: 13 }}>NPS · distribuția notelor</h3>
          <div style={{ display: "flex", height: 16, borderRadius: 6, overflow: "hidden", fontSize: 10, fontWeight: 800 }}>
            <span style={{ flex: st.det || 0.01, background: "#F2C9BC", color: "#7A2E12", display: "flex", alignItems: "center", justifyContent: "center" }}>{st.det ? `0–6 · ${st.det}%` : ""}</span>
            <span style={{ flex: Math.max(0.01, 100 - st.det - st.prom), background: "#F0E6D7", color: "#6B6259", display: "flex", alignItems: "center", justifyContent: "center" }}>{st.done && 100 - st.det - st.prom > 0 ? `7–8 · ${100 - st.det - st.prom}%` : ""}</span>
            <span style={{ flex: st.prom || 0.01, background: "var(--acc)", color: "#141414", display: "flex", alignItems: "center", justifyContent: "center" }}>{st.prom ? `9–10 · ${st.prom}%` : ""}</span>
          </div>
        </section>
        <section className="card" style={{ gap: 6 }}>
          <Dist title="Preț pe lună" items={st.price} />
          <Dist title="Model de plată" items={st.model} />
          <Dist title="Ar plăti separat pentru" items={st.extra} />
        </section>
        <section className="card" style={{ gap: 6 }}>
          <Dist title="Probleme" items={st.problems} />
          <Dist title="Frecvență" items={st.freq} />
          <Dist title="Dispozitiv" items={st.device} />
          <Dist title="Se întorc pentru" items={st.back} />
        </section>
      </div>

      <section className="card flush">
        <div style={{ padding: "14px 18px 0" }}><h2 style={{ margin: 0, fontSize: 15 }}>Răspunsurile · {rows.length}</h2></div>
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
                    <td style={{ maxWidth: 520 }}>
                      {r.answers.why ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, marginBottom: 6 }}>{String(r.answers.why)}</div> : null}
                      <details style={{ fontSize: 12 }}><summary className="muted">Toate răspunsurile</summary>
                        <table style={{ marginTop: 6, fontSize: 12 }}><tbody>{lines.map(([k, v]) => <tr key={k}><td className="muted" style={{ padding: "2px 10px 2px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td><td style={{ padding: "2px 0" }}>{v}</td></tr>)}</tbody></table>
                      </details>
                    </td>
                    <td>{r.answers.call === "yes" ? <span className="pill pillOk"><i />{String(r.answers.phone || "da")}</span> : <span className="muted">nu acum</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
