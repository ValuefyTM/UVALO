import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { activityByDay, topTargets } from "@/lib/orgs";
import { AdminShell } from "@/components/AdminShell";
import { CountTable, DayBars } from "@/components/Charts";

export const metadata: Metadata = { title: "Panou | VALUEFY Tools Admin" };
export const dynamic = "force-dynamic";

const since = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export default async function AdminHome() {
  const { db, c, pending } = await superPage();
  const [k, days, uats, { results: logins }, { results: reqs }] = await Promise.all([
    db.prepare(`SELECT (SELECT COUNT(*) FROM anevar_members WHERE in_current = 1) AS members,
        (SELECT COUNT(*) FROM users WHERE status = 'active' AND anevar_no IS NOT NULL) AS with_account,
        (SELECT COUNT(*) FROM users WHERE status = 'active') AS users,
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE action = 'login' AND at > ?1) AS login7,
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE at > ?2 AND user_id IS NOT NULL) AS active30,
        (SELECT MAX(tablou_date) FROM anevar_members) AS tablou`)
      .bind(since(7), since(30)).first<{ members: number; with_account: number; users: number; login7: number; active30: number; tablou: string | null }>(),
    activityByDay(db, 30), topTargets(db, 30, "uat_open"),
    db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.anevar_no, u.county, e.at FROM events e JOIN users u ON u.id = e.user_id
      WHERE e.action = 'login' ORDER BY e.id DESC LIMIT 12`).all<{ id: string; name: string; anevar_no: string | null; county: string | null; at: string }>(),
    db.prepare("SELECT id, name, legit, email, created_at FROM account_requests WHERE status = 'pending' ORDER BY created_at LIMIT 6").all<{ id: string; name: string; legit: string; email: string; created_at: string }>(),
  ]);
  const pct = k && k.members ? Math.round((k.with_account / k.members) * 1000) / 10 : 0;
  return (
    <AdminShell c={c} active="panou" pending={pending} title="Panou" subtitle={k?.tablou ? `Tablou ANEVAR la ${fmtDate(k.tablou)}` : undefined}>
      <div className="kpis">
        <div className="kpi"><small>Membri în tablou</small><b>{(k?.members ?? 0).toLocaleString("ro-RO")}</b></div>
        <div className="kpi"><small>Cu cont activ</small><b>{k?.with_account ?? 0} <span className="muted" style={{ fontSize: 13 }}>· {pct}%</span></b></div>
        <div className="kpi"><small>Solicitări în așteptare</small><b>{pending}</b></div>
        <div className="kpi"><small>Autentificați · 7 zile</small><b>{k?.login7 ?? 0}</b></div>
        <div className="kpi"><small>Activi · 30 zile</small><b>{k?.active30 ?? 0}</b></div>
      </div>
      {reqs.length > 0 && (
        <section className="card">
          <div className="cardHead"><h2>Solicitări în așteptare</h2><a className="btn btnNavy btnSm" href="/admin/solicitari">Aprobă / respinge →</a></div>
          <ul className="docList">
            {reqs.map((r) => <li key={r.id}><span className="who"><b>{r.name}</b><small>Legitimație {r.legit} · {r.email} · {fmtDate(r.created_at, true)}</small></span></li>)}
          </ul>
        </section>
      )}
      <div className="cols">
        <DayBars days={days} label="Activitate, ultimele 30 de zile" />
        <section className="card">
          <h2>Ultimele autentificări</h2>
          {logins.length === 0 ? <p className="hint">Nimeni nu s-a autentificat încă.</p> : (
            <ul className="docList">
              {logins.map((l, i) => <li key={i}><span className="who"><b>{l.name}</b><small>{[l.anevar_no && `leg. ${l.anevar_no}`, l.county, fmtDate(l.at, true)].filter(Boolean).join(" · ")}</small></span><a className="link" href={`/admin/activitate?user=${l.id}`}>Activitate</a></li>)}
            </ul>
          )}
        </section>
      </div>
      <CountTable title="Localități cele mai folosite (30 de zile)" rows={uats.map((u) => [u.target, u.n, u.u])} head={["UAT", "Deschideri", "Persoane"]} empty="Nicio localitate deschisă încă." />
    </AdminShell>
  );
}
