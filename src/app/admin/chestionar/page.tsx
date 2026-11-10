import type { Metadata } from "next";
import { superPage } from "@/lib/guard";
import { AdminShell } from "@/components/AdminShell";
import { SurveyNav } from "@/components/SurveyNav";
import { surveyDetail, surveyRows, surveySettings, type Dist, type Person } from "@/lib/survey";

export const metadata: Metadata = { title: "Chestionar | UVALO Admin" };
export const dynamic = "force-dynamic";

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
const f1 = (n: number | null) => (n === null ? "—" : n.toFixed(1).replace(".", ","));

/** The people behind a figure: names (with their note), folded. */
function Who({ who }: { who: Person[] }) {
  if (!who.length) return null;
  return (
    <details className="sqWho">
      <summary>{who.length === 1 ? "cine" : `cine · ${who.length}`}</summary>
      <span>{who.map((p) => <a key={p.user_id} href={`/admin/activitate?user=${p.user_id}`} title={p.org ?? ""}>{p.who}{p.nps !== null && <i>{p.nps}</i>}</a>)}</span>
    </details>
  );
}

/** One option of a question: label, bar, count and share of those who answered it. */
function Bars({ d, tone }: { d: Dist; tone?: (k: string) => string | undefined }) {
  const max = Math.max(1, ...d.items.map((i) => i.n));
  return (
    <div className="sqBars">
      {d.items.map((i) => (
        <div key={i.k} className="sqBar">
          <span className="sqLbl" title={i.label}>{i.label}</span>
          <span className="sqTrack"><i style={{ width: `${(i.n / max) * 100}%`, background: tone?.(i.k) }} /></span>
          <b>{i.n}</b><small>{pct(i.n, d.n)}</small>
          <Who who={i.who} />
        </div>
      ))}
    </div>
  );
}

/** A question card: the step, the question, how many answered, the figures. */
function Q({ step, title, n, of, children, note }: { step: number; title: string; n: number; of: number; children: React.ReactNode; note?: string }) {
  return (
    <section className="card sqQ" id={`q-${step}-${title.slice(0, 12).replace(/\W+/g, "")}`}>
      <header><span className="sqStep">Pasul {step}</span><h2>{title}</h2><small>{n} {n === 1 ? "răspuns" : "răspunsuri"}{of ? ` · ${pct(n, of)} din cei care au deschis` : ""}</small></header>
      {children}
      {note && <p className="sqNote">{note}</p>}
    </section>
  );
}

/** Admin → Chestionar: the results, question by question, with the people behind every figure. */
export default async function SurveyStatsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { db, c, pending } = await superPage();
  const s = await surveySettings(db);
  const id = (await searchParams).id || s.id;
  const rows = await surveyRows(db, id);
  const d = surveyDetail(rows, s.wants);
  const { results: older } = await db.prepare("SELECT survey_id AS id, COUNT(*) AS n, SUM(done_at IS NOT NULL) AS d FROM survey_answers GROUP BY survey_id ORDER BY MAX(created_at) DESC").all<{ id: string; n: number; d: number }>();
  const eligible = (await db.prepare("SELECT COUNT(*) AS n FROM (SELECT user_id FROM events e JOIN users u ON u.id = e.user_id AND u.status = 'active' AND u.is_superadmin = 0 GROUP BY user_id HAVING COUNT(*) >= ?)").bind(s.min_actions).first<{ n: number }>())?.n ?? 0;
  const topPrice = d.price.items.slice().sort((a, b) => b.n - a.n)[0];
  const maxHist = Math.max(1, ...d.nps.hist.map((h) => h.n));
  const maxW = Math.max(1, ...d.wants.map((w) => w.pts));
  const gold = "var(--acc)", red = "#C9664A", green = "#2E9E5B", grey = "#C9C1B5";
  return (
    <AdminShell c={c} active="chestionar" pending={pending} title="Chestionarul de feedback" subtitle={`${id}${id === s.id ? (s.on ? " · activ, se afișează" : " · activ, oprit") : " · chestionar anterior"} · ${d.done} complete din ${d.n} deschise · ${eligible} conturi eligibile acum`}
      actions={<a className="btn btnGhost btnSm" href={`/api/admin/survey?csv=1${id === s.id ? "" : `&id=${encodeURIComponent(id)}`}`}>Exportă CSV</a>}>
      <SurveyNav page="stats" id={id} activeId={s.id} older={older} />

      {/* the figures */}
      <div className="kpis sqKpis">
        <div className="card kpi"><b>{d.done}</b><small>complete</small><span>{d.n - d.done} începute sau doar deschise · {pct(d.done, d.n)} finalizare</span></div>
        <div className="card kpi"><b style={{ color: d.nps.score === null ? undefined : d.nps.score >= 0 ? "var(--ok-text)" : "var(--err)" }}>{d.nps.score === null ? "—" : `${d.nps.score > 0 ? "+" : ""}${d.nps.score}`}</b><small>NPS</small><span>{pct(d.nps.prom, d.nps.n)} promotori · {pct(d.nps.pass, d.nps.n)} pasivi · {pct(d.nps.det, d.nps.n)} detractori</span></div>
        <div className="card kpi"><b>{f1(d.nps.avg)}</b><small>nota medie 0–10</small><span>{d.nps.n} note</span></div>
        <div className="card kpi"><b>{f1(d.tools.filter((t) => t.avg !== null).length ? d.tools.reduce((a, t) => a + (t.avg ?? 0), 0) / d.tools.filter((t) => t.avg !== null).length : null)}</b><small>instrumentele · media stelelor</small><span>cel mai bine: {d.tools.slice().sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0]?.avg !== null ? d.tools.slice().sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0]?.label : "—"}</span></div>
        <div className="card kpi"><b>{d.calls.length}</b><small>vor să fie sunați</small><span>{d.calls.filter((x) => x.phone).length} cu telefon</span></div>
        <div className="card kpi"><b style={{ fontSize: 22 }}>{topPrice?.n ? topPrice.label : "—"}</b><small>prețul cel mai ales</small><span>{topPrice?.n ? `${topPrice.n} din ${d.price.n}` : "niciun răspuns"}</span></div>
      </div>

      {/* the funnel */}
      <section className="card sqQ">
        <header><span className="sqStep">Parcurs</span><h2>Până unde au ajuns</h2><small>{d.n} au deschis chestionarul</small></header>
        <div className="sqFunnel">
          {["Deschis", "Nota 0–10", "Instrumentele", "Ce le-ar fi util", "Probleme, obiceiuri", "Preț, discuție", "Complet"].map((l, i) => {
            const n = i === 6 ? d.done : d.steps[i]?.n ?? 0;
            return <div key={l} className="sqFun"><b>{n}</b><i style={{ height: `${Math.max(6, (n / Math.max(1, d.n)) * 100)}%` }} /><small>{l}</small></div>;
          })}
        </div>
      </section>

      <div className="sqGrid">
        <Q step={1} title="Cât de probabil e să recomanzi UVALO unui coleg evaluator?" n={d.nps.n} of={d.n}>
          <div className="sqHist" role="img" aria-label={`Note 0–10: ${d.nps.hist.map((h) => `${h.k}: ${h.n}`).join(", ")}`}>
            {d.nps.hist.map((h) => (
              <div key={h.k} className="sqCol" title={`Nota ${h.k} · ${h.n}`}>
                <b>{h.n || ""}</b>
                <i style={{ height: `${Math.max(h.n ? 8 : 2, (h.n / maxHist) * 100)}%`, background: h.k <= 6 ? red : h.k <= 8 ? grey : gold }} />
                <small>{h.k}</small>
              </div>
            ))}
          </div>
          <div className="sqSplit">
            <span style={{ flex: d.nps.det || 0.001, background: "#F2C9BC", color: "#7A2E12" }}>{d.nps.det ? `Detractori 0–6 · ${d.nps.det}` : ""}</span>
            <span style={{ flex: d.nps.pass || 0.001, background: "#F0E6D7", color: "#6B6259" }}>{d.nps.pass ? `Pasivi 7–8 · ${d.nps.pass}` : ""}</span>
            <span style={{ flex: d.nps.prom || 0.001, background: gold, color: "#141414" }}>{d.nps.prom ? `Promotori 9–10 · ${d.nps.prom}` : ""}</span>
          </div>
          <Bars d={{ n: d.nps.n, items: [
            { k: "det", label: "Detractori (0–6)", n: d.nps.det, who: d.nps.hist.filter((h) => h.k <= 6).flatMap((h) => h.who) },
            { k: "pass", label: "Pasivi (7–8)", n: d.nps.pass, who: d.nps.hist.filter((h) => h.k >= 7 && h.k <= 8).flatMap((h) => h.who) },
            { k: "prom", label: "Promotori (9–10)", n: d.nps.prom, who: d.nps.hist.filter((h) => h.k >= 9).flatMap((h) => h.who) },
          ] }} tone={(k) => (k === "det" ? red : k === "pass" ? grey : gold)} />
        </Q>

        <Q step={1} title="Ce te-a făcut să dai nota asta?" n={d.why.length} of={d.nps.n} note="Ordonate de la nota cea mai mică la cea mai mare: motivele detractorilor primele.">
          {d.why.length ? (
            <ul className="sqTexts">{d.why.map((w) => <li key={w.user_id}><span className={`sqN ${w.nps === null ? "" : w.nps <= 6 ? "det" : w.nps <= 8 ? "pass" : "prom"}`}>{w.nps ?? "–"}</span><p>{w.text}</p><a href={`/admin/activitate?user=${w.user_id}`}>{w.who}{w.org ? ` · ${w.org}` : ""}</a></li>)}</ul>
          ) : <p className="sqEmpty">Nimeni nu a scris un motiv încă.</p>}
        </Q>

        <Q step={2} title="Ce instrumente folosești și ce notă le dai?" n={d.toolsN} of={d.n} note="Media doar pe cei care l-au notat; „nefolosit” = l-au bifat ca nefolosit. Stelele 1–2 sunt roșii.">
          <div className="sqTools">
            {d.tools.slice().sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)).map((t) => (
              <div key={t.key} className="sqTool">
                <div className="sqToolHead"><b>{t.label}</b><span className="sqAvg">{f1(t.avg)}<small> / 5</small></span><small>{t.rated} {t.rated === 1 ? "notă" : "note"} · {t.none} nefolosit</small></div>
                <div className="sqStars">
                  {t.stars.map((st) => (
                    <span key={st.k} className="sqStar" title={`${st.label} · ${st.n}`}>
                      <i style={{ height: `${Math.max(st.n ? 10 : 2, (st.n / Math.max(1, ...t.stars.map((x) => x.n))) * 100)}%`, background: Number(st.k) <= 2 ? red : Number(st.k) === 3 ? grey : green }} /><small>{st.k}</small><b>{st.n || ""}</b>
                    </span>
                  ))}
                  <span className="sqStar none" title={`Nefolosit · ${t.none}`}><i style={{ height: `${Math.max(t.none ? 10 : 2, (t.none / Math.max(1, t.asked)) * 100)}%` }} /><small>nu</small><b>{t.none || ""}</b></span>
                </div>
                {t.low.length > 0 && <details className="sqWho"><summary>sub 3 stele · {t.low.length}</summary><span>{t.low.map((p) => <a key={p.user_id} href={`/admin/activitate?user=${p.user_id}`} title={p.text}>{p.who}<i>{p.v}★</i></a>)}</span></details>}
              </div>
            ))}
          </div>
        </Q>

        <Q step={3} title="Ce ți-ar fi cel mai util în continuare?" n={d.wantsN} of={d.n} note="Cel mult 3 alegeri, în ordine: locul 1 = 3 puncte, locul 2 = 2, locul 3 = 1. Coloanele arată de câte ori a fost pe fiecare loc.">
          <div className="sqWants">
            {d.wants.map((w) => (
              <div key={w.i} className="sqWant">
                <span className="sqLbl" title={w.detail}>{w.label}</span>
                <span className="sqTrack"><i style={{ width: `${(w.pts / maxW) * 100}%` }} /></span>
                <b>{w.pts} p</b>
                <small className="sqPos" title="pe locul 1 · 2 · 3"><em>{w.pos[0]}</em><em>{w.pos[1]}</em><em>{w.pos[2]}</em></small>
                <Who who={w.who} />
              </div>
            ))}
          </div>
          {d.wantsOther.length > 0 && <><h3 className="sqH3">Altceva · {d.wantsOther.length}</h3><ul className="sqTexts plain">{d.wantsOther.map((w) => <li key={w.user_id}><p>{w.text}</p><a href={`/admin/activitate?user=${w.user_id}`}>{w.who}</a></li>)}</ul></>}
        </Q>

        <Q step={4} title="Ai întâmpinat probleme în UVALO?" n={d.problems.n} of={d.n}>
          <Bars d={d.problems} tone={(k) => (k === "none" ? green : k === "quit" ? red : k === "often" ? "#E0945A" : grey)} />
          {d.problemsText.length > 0 && <><h3 className="sqH3">Ce anume · {d.problemsText.length}</h3><ul className="sqTexts">{d.problemsText.map((w) => <li key={w.user_id}><span className="sqN tag">{w.kind}</span><p>{w.text}</p><a href={`/admin/activitate?user=${w.user_id}`}>{w.who}{w.org ? ` · ${w.org}` : ""}</a></li>)}</ul></>}
        </Q>

        <Q step={4} title="Cât de des folosești UVALO?" n={d.freq.n} of={d.n}><Bars d={d.freq} /></Q>
        <Q step={4} title="De pe ce lucrezi mai ales?" n={d.device.n} of={d.n}><Bars d={d.device} /></Q>
        <Q step={4} title="Ce te-a făcut să te întorci în UVALO?" n={d.back.n} of={d.n}><Bars d={d.back} /></Q>

        <Q step={5} title="Cât ai fi dispus să plătești pe lună pentru UVALO, așa cum e acum?" n={d.price.n} of={d.n} note="Pe evaluator.">
          <Bars d={d.price} tone={(k) => (k === "none" ? grey : k === "gt40" || k === "p20_40" ? green : gold)} />
        </Q>
        <Q step={5} title="Ce model de plată ți se pare corect?" n={d.model.n} of={d.n}><Bars d={d.model} /></Q>
        <Q step={5} title="Pentru ce ai plăti separat, dacă ar fi opțional?" n={d.extra.n} of={d.n} note="Alegere multiplă: procentele se adună peste 100.">
          <Bars d={d.extra} />
        </Q>

        <Q step={5} title="Putem vorbi 15 minute?" n={d.calls.length} of={d.n} note="Cei care au bifat „da”; telefonul e cel scris în chestionar.">
          {d.calls.length ? (
            <div className="tableWrap"><table className="table sqCalls">
              <thead><tr><th>Cine</th><th>Telefon</th><th>Nota</th><th>Ar plăti</th><th>Când</th></tr></thead>
              <tbody>{d.calls.map((x) => (
                <tr key={x.user_id}><td><a className="rowLink" href={`/admin/activitate?user=${x.user_id}`}><b>{x.who}</b></a><div className="muted" style={{ fontSize: 12 }}>{x.email}{x.org ? ` · ${x.org}` : ""}</div></td>
                  <td>{x.phone ? <a href={`tel:${x.phone.replace(/[^\d+]/g, "")}`}>{x.phone}</a> : <span className="muted">fără</span>}</td>
                  <td>{x.nps === null ? "—" : <span className={`pill ${x.nps >= 9 ? "pillWarn" : x.nps <= 6 ? "pillErr" : ""}`}>{x.nps}</span>}</td>
                  <td>{x.price}</td><td className="mono">{new Date(x.at).toLocaleDateString("ro-RO")}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="sqEmpty">Nimeni nu a cerut să fie sunat.</p>}
        </Q>
      </div>
    </AdminShell>
  );
}
