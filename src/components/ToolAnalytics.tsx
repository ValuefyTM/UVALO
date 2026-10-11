/** Usage of one tool in the administration: who uses it, how much, for what (server-rendered). */
import { actionLabel, type EventRow } from "@/lib/orgs";
import { fmtDate } from "@/lib/guard";
import type { toolUsage } from "@/lib/tools";
import { CountTable, DayBars, EventLog } from "./Charts";

type Usage = Awaited<ReturnType<typeof toolUsage>>;

export function ToolAnalytics({ u, events, targetLabel }: { u: Usage; events: EventRow[]; targetLabel?: string }) {
  return (
    <>
      <div className="kpis">
        <div className="kpi"><small>Utilizatori · 7 zile</small><b>{u.k.users7}</b></div>
        <div className="kpi"><small>Utilizatori · 30 zile</small><b>{u.k.users}</b></div>
        <div className="kpi"><small>Firme · 30 zile</small><b>{u.k.orgs}</b></div>
        <div className="kpi"><small>Acțiuni · 30 zile</small><b>{u.k.n.toLocaleString("ro-RO")}</b></div>
        <div className="kpi"><small>Utilizatori de la început</small><b>{u.k.usersAll}</b></div>
      </div>
      <DayBars days={u.days} label="Folosire pe zi, ultimele 30 de zile" />
      <CountTable title="Ce se folosește (30 de zile)" rows={u.actions.map((a) => [actionLabel(a.action), a.n, a.u])} head={["Acțiune", "De câte ori", "Persoane"]} empty="Nicio folosire în ultimele 30 de zile." />
      {targetLabel && <CountTable title={`${targetLabel} (30 de zile)`} rows={u.targets.map((t) => [t.target, t.n, t.u])} head={["Imobil", "De câte ori", "Persoane"]} empty="—" />}
      <section className="card flush">
        <div className="cardHead"><h2>Cine îl folosește (30 de zile)</h2></div>
        {u.people.length === 0 ? <p className="hint pad">Nimeni încă.</p> : (
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Utilizator</th><th>Firmă</th><th className="r">Acțiuni</th><th>Ultima folosire</th><th /></tr></thead>
              <tbody>
                {u.people.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b><div className="muted" style={{ fontSize: 12 }}>{[p.email, p.anevar_no && `leg. ${p.anevar_no}`].filter(Boolean).join(" · ")}</div></td>
                    <td>{p.org ?? "—"}</td>
                    <td className="r mono">{p.n.toLocaleString("ro-RO")}</td>
                    <td className="mono">{fmtDate(p.last, true)}</td>
                    <td><a className="link" href={`/admin/activitate?user=${p.id}`}>Activitate</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <EventLog rows={events} />
    </>
  );
}
