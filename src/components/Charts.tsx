/** Small server-rendered charts and tables for the activity pages. */
import { actionLabel, type EventRow } from "@/lib/orgs";
import { fmtDate } from "@/lib/guard";

export function DayBars({ days, label }: { days: { d: string; n: number; u: number }[]; label: string }) {
  const max = Math.max(1, ...days.map((x) => x.n));
  const total = days.reduce((s, x) => s + x.n, 0);
  return (
    <section className="card">
      <div className="cardHead"><h2>{label}</h2><span className="muted">{total.toLocaleString("ro-RO")} acțiuni</span></div>
      <div className="bars" role="img" aria-label={`${label}: ${total} acțiuni`}>
        {days.map((x) => <i key={x.d} style={{ height: `${(x.n / max) * 100}%` }} data-t={`${x.d.split("-").reverse().join(".")}: ${x.n} acțiuni · ${x.u} persoane`} />)}
      </div>
      <div className="muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span>{days[0]?.d.split("-").reverse().join(".")}</span><span>azi</span></div>
    </section>
  );
}

export function CountTable({ title, rows, head, empty }: { title: string; rows: [string, number, number?][]; head: [string, string, string?]; empty: string }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="hint">{empty}</p> : (
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>{head[0]}</th><th className="r">{head[1]}</th>{head[2] && <th className="r">{head[2]}</th>}</tr></thead>
            <tbody>{rows.map(([a, b, c]) => <tr key={a}><td>{a}</td><td className="r mono">{b.toLocaleString("ro-RO")}</td>{head[2] && <td className="r mono">{c ?? "—"}</td>}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function EventLog({ rows, showOrg = true, showUser = true }: { rows: EventRow[]; showOrg?: boolean; showUser?: boolean }) {
  return (
    <section className="card flush">
      <div className="cardHead"><h2>Activitate recentă</h2></div>
      {rows.length === 0 ? <p className="hint pad">Nicio activitate încă.</p> : (
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Când</th>{showUser && <th>Cine</th>}{showOrg && <th>Firmă</th>}<th>Ce</th><th>Detalii</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{fmtDate(e.at, true)}</td>
                  {showUser && <td>{e.user_name || e.email || "—"}</td>}
                  {showOrg && <td>{e.org_name || "—"}</td>}
                  <td>{actionLabel(e.action)}</td>
                  <td className="mono">{e.target ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Localities opened (UAT name, opens, people), grouped by county; `countyOf` maps a UAT name to its county. */
export function UatCountTable({ title, rows, countyOf, empty }: { title: string; rows: { target: string; n: number; u: number }[]; countyOf: Record<string, string>; empty: string }) {
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const c = countyOf[r.target] ?? "Alte localități";
    groups.set(c, [...(groups.get(c) ?? []), r]);
  }
  const ordered = [...groups].sort((a, b) => b[1].reduce((s, r) => s + r.n, 0) - a[1].reduce((s, r) => s + r.n, 0));
  return (
    <section className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="hint">{empty}</p> : (
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>UAT</th><th className="r">Deschideri</th><th className="r">Persoane</th></tr></thead>
            {ordered.map(([c, list]) => (
              <tbody key={c}>
                <tr className="groupRow"><td>Județul {c}</td><td className="r mono">{list.reduce((s, r) => s + r.n, 0).toLocaleString("ro-RO")}</td><td /></tr>
                {list.map((r) => <tr key={r.target}><td>{r.target}</td><td className="r mono">{r.n.toLocaleString("ro-RO")}</td><td className="r mono">{r.u}</td></tr>)}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}
