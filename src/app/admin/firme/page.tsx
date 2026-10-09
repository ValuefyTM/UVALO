import type { Metadata } from "next";
import { countyOfUats } from "@/lib/plans";
import { fmtDate, superPage } from "@/lib/guard";
import { orgBlock, ORG_SQL, type Org } from "@/lib/access";
import { activityByDay, topTargets } from "@/lib/orgs";
import { AdminShell } from "@/components/AdminShell";
import { OrgForm } from "@/components/forms";
import { DayBars, UatCountTable } from "@/components/Charts";

export const metadata: Metadata = { title: "Firme | UVALO Admin" };
export const dynamic = "force-dynamic";

const since = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export default async function AdminFirms() {
  const { db, c, pending } = await superPage();
  const [{ results: orgs }, kp, days, uats, { results: plans }] = await Promise.all([
    db.prepare(`${ORG_SQL.replace("SELECT o.*", `SELECT o.*,
        (SELECT COUNT(*) FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = o.id AND m.status = 'active' AND u.status <> 'disabled') AS used,
        (SELECT COUNT(DISTINCT e.user_id) FROM events e WHERE e.org_id = o.id AND e.at > ?1) AS active_30,
        (SELECT COUNT(*) FROM events e WHERE e.org_id = o.id AND e.at > ?1) AS events_30,
        (SELECT MAX(e.at) FROM events e WHERE e.org_id = o.id) AS last_at`)} ORDER BY o.status = 'active' DESC, o.name`)
      .bind(since(30)).all<Org & { used: number; active_30: number; events_30: number; last_at: string | null }>(),
    db.prepare(`SELECT (SELECT COUNT(*) FROM orgs WHERE status = 'active') AS orgs, (SELECT COUNT(*) FROM users WHERE status = 'active') AS users,
        (SELECT COUNT(*) FROM users WHERE status = 'invited') AS invited,
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE at > ?1) AS active7, (SELECT COUNT(DISTINCT user_id) FROM events WHERE at > ?2) AS active30`)
      .bind(since(7), since(30)).first<{ orgs: number; users: number; invited: number; active7: number; active30: number }>(),
    activityByDay(db, 30), topTargets(db, 30, "uat_open"),
    db.prepare("SELECT id, name FROM plans WHERE active = 1 ORDER BY sort").all<{ id: string; name: string }>(),
  ]);
  const countyOf = await countyOfUats();
  return (
    <AdminShell c={c} active="firme" pending={pending} title="Firme și abonamente" subtitle="Conturile individuale aprobate și firmele cu mai mulți utilizatori">
      <div className="kpis">
        <div className="kpi"><small>Firme active</small><b>{kp?.orgs ?? 0}</b></div>
        <div className="kpi"><small>Utilizatori activi</small><b>{kp?.users ?? 0}</b></div>
        <div className="kpi"><small>Invitații în așteptare</small><b>{kp?.invited ?? 0}</b></div>
        <div className="kpi"><small>Folosesc · 7 zile</small><b>{kp?.active7 ?? 0}</b></div>
        <div className="kpi"><small>Folosesc · 30 zile</small><b>{kp?.active30 ?? 0}</b></div>
      </div>
      <section className="card flush">
        <div className="cardHead"><h2>Firme</h2></div>
        {orgs.length === 0 ? <p className="hint pad">Nicio firmă încă. Creează prima firmă mai jos și invită-i titularul.</p> : (
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Firmă</th><th>Plan</th><th>Locuri</th><th>Acces până la</th><th className="r">Activi 30 zile</th><th className="r">Acțiuni 30 zile</th><th>Ultima activitate</th><th>Stare</th></tr></thead>
              <tbody>
                {orgs.map((o) => {
                  const b = orgBlock(o);
                  return (
                    <tr key={o.id}>
                      <td><a className="rowLink" href={`/admin/firme/${o.id}`}>{o.name}</a>{o.city && <span className="muted block">{o.city}{o.cui ? ` · CUI ${o.cui}` : ""}</span>}</td>
                      <td>{o.plan_name}</td>
                      <td className="mono">{o.used} / {o.seats}</td>
                      <td>{o.valid_until ? fmtDate(o.valid_until) : "fără termen"}</td>
                      <td className="r mono">{o.active_30}</td>
                      <td className="r mono">{o.events_30}</td>
                      <td>{o.last_at ? fmtDate(o.last_at, true) : "—"}</td>
                      <td><span className={`pill ${b ? "pillErr" : "pillOk"}`}><i />{b ? (o.status !== "active" ? "Suspendată" : "Expirată") : "Activă"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="cols">
        <DayBars days={days} label="Activitate pe platformă, ultimele 30 de zile" />
        <UatCountTable title="Localități cele mai folosite (30 de zile)" rows={uats} countyOf={countyOf} empty="Nicio localitate deschisă încă." />
      </div>
      <OrgForm plans={plans} />
    </AdminShell>
  );
}
