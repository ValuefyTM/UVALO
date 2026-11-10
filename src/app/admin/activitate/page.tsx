import type { Metadata } from "next";
import { countyOfUats } from "@/lib/plans";
import { fmtDate, superPage } from "@/lib/guard";
import { activityByDay, actionLabel, recentEvents, toolUsage, topActions, topTargets, topUsers, userTotals, type ToolUse } from "@/lib/orgs";
import { TOOLS } from "@/lib/tools";
import { AdminShell } from "@/components/AdminShell";
import { CountTable, DayBars, EventLog, UatCountTable } from "@/components/Charts";

export const metadata: Metadata = { title: "Activitate | UVALO" };
export const dynamic = "force-dynamic";

const DAYS = 30;
const OTHER: Record<string, string> = { auth: "Autentificare", app: "Autentificare și pagini", home: "Acasă", user: "Contul meu", office: "Birou de evaluare" };
const moduleName = (m: string) => TOOLS.find((t) => t.key === m)?.name ?? OTHER[m] ?? m;
const isTool = (m: string) => TOOLS.some((t) => t.key === m);

/** Use per tool, as horizontal bars (share of all actions). */
function ToolBars({ rows, title, showPeople = true }: { rows: ToolUse[]; title: string; showPeople?: boolean }) {
  const list = rows.filter((r) => isTool(r.module));
  const max = Math.max(1, ...list.map((r) => r.n));
  const total = list.reduce((s, r) => s + r.n, 0);
  return (
    <section className="card">
      <div className="cardHead"><h2>{title}</h2><span className="muted">{total.toLocaleString("ro-RO")} acțiuni</span></div>
      {list.length === 0 ? <p className="hint">Niciun instrument folosit în ultimele {DAYS} de zile.</p> : (
        <ul className="toolBars">
          {list.map((r) => (
            <li key={r.module}>
              <span className="toolBarsTop">
                <b>{moduleName(r.module)}</b>
                <small className="muted">
                  {r.n.toLocaleString("ro-RO")} acțiuni · {Math.round((r.n / Math.max(1, total)) * 100)}%
                  {showPeople ? ` · ${r.u === 1 ? "1 persoană" : `${r.u} persoane`}` : ` · ${r.days === 1 ? "1 zi" : `${r.days} zile`}`} · ultima {fmtDate(r.last, true)}
                </small>
              </span>
              <span className="toolBarsTrack"><i style={{ width: `${(r.n / max) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminActivity({ searchParams }: { searchParams: Promise<{ user?: string; org?: string; action?: string }> }) {
  const { db, c, pending } = await superPage();
  const f = await searchParams;
  const who = f.user
    ? await db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS n, u.email, u.anevar_no, u.county, u.status, u.created_at,
          (SELECT o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active' ORDER BY m.created_at LIMIT 1) AS org_name
        FROM users u WHERE u.id = ?`).bind(f.user).first<{ id: string; n: string; email: string; anevar_no: string | null; county: string | null; status: string; created_at: string; org_name: string | null }>()
    : null;
  const uid = who?.id;
  const [days, acts, uats, parcels, events, tools, top, people, totals] = await Promise.all([
    activityByDay(db, DAYS, f.org, uid), topActions(db, DAYS, f.org, uid), topTargets(db, DAYS, "uat_open", f.org, uid), topTargets(db, DAYS, "parcel", f.org, uid),
    recentEvents(db, { userId: uid, orgId: f.org, action: f.action, limit: uid ? 200 : 300 }),
    toolUsage(db, DAYS, f.org, uid), uid ? Promise.resolve([]) : topUsers(db, DAYS, 5, f.org), topUsers(db, DAYS, 300, f.org),
    uid ? userTotals(db, uid, DAYS) : Promise.resolve(null),
  ]);
  const countyOf = await countyOfUats();
  const favorite = tools.find((t) => isTool(t.module));

  const picker = (
    <form className="card actPick" method="get">
      <label className="field grow">Statistici pentru
        <select className="select" name="user" defaultValue={uid ?? ""}>
          <option value="">Toți utilizatorii</option>
          {who && !people.some((p) => p.id === who.id) && <option value={who.id}>{who.n} (fără activitate în {DAYS} de zile)</option>}
          {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.email} · {p.n.toLocaleString("ro-RO")} acțiuni</option>)}
        </select>
      </label>
      {f.org && <input type="hidden" name="org" value={f.org} />}
      <button className="btn btnNavy btnSm" type="submit">Arată</button>
    </form>
  );

  return (
    <AdminShell c={c} active="activitate" pending={pending} title="Activitate" subtitle={who ? `Statistici: ${who.n}` : "Ce fac utilizatorii în platformă"} actions={who ? <a className="btn btnGhost btnSm" href="/admin/activitate">Toată activitatea</a> : undefined}>
      {picker}
      {who && totals ? (
        <>
          <section className="card actUser">
            <span className="actUserId">
              <b>{who.n}</b>
              <small className="muted">{[who.email !== who.n ? who.email : null, who.org_name, who.anevar_no ? `Legitimație ${who.anevar_no}` : "Fără legitimație", who.county].filter(Boolean).join(" · ")}</small>
              <small className="muted">Cont din {fmtDate(who.created_at)}{who.status !== "active" ? ` · stare: ${who.status}` : ""}</small>
            </span>
            <a className="btn btnGhost btnSm" href={`/admin/utilizatori?q=${encodeURIComponent(who.email)}`}>Fișa utilizatorului</a>
          </section>
          <div className="kpis">
            <div className="kpi"><small>Acțiuni · {DAYS} zile</small><b>{totals.n.toLocaleString("ro-RO")}</b>{totals.n > 0 && <small className="muted">locul {totals.rank} din {totals.people}</small>}</div>
            <div className="kpi"><small>Zile active · {DAYS} zile</small><b>{totals.days}</b><small className="muted">{totals.sessions === 1 ? "1 autentificare" : `${totals.sessions} autentificări`}</small></div>
            <div className="kpi"><small>Instrumentul preferat</small><b style={{ fontSize: 18 }}>{favorite ? moduleName(favorite.module) : "—"}</b>{favorite && <small className="muted">{favorite.n.toLocaleString("ro-RO")} acțiuni</small>}</div>
            <div className="kpi"><small>Ultima activitate</small><b style={{ fontSize: 18 }}>{totals.last ? fmtDate(totals.last, true) : "—"}</b><small className="muted">{totals.total.toLocaleString("ro-RO")} acțiuni de la început{totals.first ? ` (${fmtDate(totals.first)})` : ""}</small></div>
          </div>
          <DayBars days={days} label={`Acțiunile lui ${who.n.split(" ")[0]} pe zi, ultimele ${DAYS} de zile`} />
          <div className="cols">
            <ToolBars rows={tools} title={`Instrumente folosite (${DAYS} de zile)`} showPeople={false} />
            <CountTable title={`Ce a făcut (${DAYS} de zile)`} rows={acts.filter((a) => a.module !== "admin").map((a) => [`${actionLabel(a.action)} · ${moduleName(a.module)}`, a.n])} head={["Acțiune", "De câte ori"]} empty="Nicio activitate." />
          </div>
          <div className="cols">
            <UatCountTable title={`Localități (${DAYS} de zile)`} rows={uats} countyOf={countyOf} empty="Niciun plan deschis." />
            <CountTable title="Parcele deschise" rows={parcels.map((u) => [u.target, u.n])} head={["Nr. cadastral", "Deschideri"]} empty="Nicio parcelă deschisă." />
          </div>
          <EventLog rows={events} showUser={false} />
        </>
      ) : (
        <>
          {f.user && <p className="hint">Utilizatorul nu există (poate a fost șters).</p>}
          <div className="cols">
            <section className="card flush">
              <div className="cardHead"><h2>Cei mai activi utilizatori ({DAYS} de zile)</h2></div>
              {top.length === 0 ? <p className="hint actPad">Nicio activitate.</p> : (
                <ol className="topUsers">
                  {top.map((u, i) => (
                    <li key={u.id}>
                      <a href={`/admin/activitate?user=${u.id}`}>
                        <span className="topUsersRank">{i + 1}</span>
                        <span className="topUsersName"><b>{u.name || u.email}</b><small className="muted">{[u.org_name, u.top ? `mai ales ${moduleName(u.top)}` : null].filter(Boolean).join(" · ")}</small></span>
                        <span className="topUsersNum"><b>{u.n.toLocaleString("ro-RO")}</b><small className="muted">{u.days === 1 ? "1 zi" : `${u.days} zile`} · {fmtDate(u.last)}</small></span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
              <p className="hint actPad">Fără acțiunile din admin. Alege pe cineva ca să-i vezi statisticile.</p>
            </section>
            <ToolBars rows={tools} title={`Cele mai folosite instrumente (${DAYS} de zile)`} />
          </div>
          <DayBars days={days} label={`Acțiuni pe zi, ultimele ${DAYS} de zile`} />
          <div className="cols">
            <CountTable title={`Ce se folosește (${DAYS} de zile)`} rows={acts.map((a) => [`${actionLabel(a.action)}${a.module !== "localizare" ? ` · ${moduleName(a.module)}` : ""}`, a.n])} head={["Acțiune", "De câte ori"]} empty="Nicio activitate." />
            <UatCountTable title={`Localități (${DAYS} de zile)`} rows={uats} countyOf={countyOf} empty="—" />
          </div>
          <CountTable title={`Parcele deschise cel mai des (${DAYS} de zile)`} rows={parcels.map((u) => [u.target, u.n, u.u])} head={["Nr. cadastral", "Deschideri", "Persoane"]} empty="—" />
          <EventLog rows={events} />
        </>
      )}
    </AdminShell>
  );
}
