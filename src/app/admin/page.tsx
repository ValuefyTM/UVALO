import type { Metadata } from "next";
import { countyOfUats } from "@/lib/plans";
import { fmtDate, superPage } from "@/lib/guard";
import { activityByDay, topTargets } from "@/lib/orgs";
import { AdminShell } from "@/components/AdminShell";
import { AdminInstall } from "@/components/AdminInstall";
import { DayBars, UatCountTable } from "@/components/Charts";
import { MaintenanceCard } from "@/components/admin";
import { DEFAULT_MESSAGE, maintenance } from "@/lib/maintenance";
import { device } from "@/lib/ua";
import { uats as uatList } from "@/lib/cadastre";

/** Midnight in Romania (summer or winter time), as an ISO instant. */
function dayStartRo() {
  const n = new Date(), local = new Date(n.toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
  const offset = local.getTime() - n.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset).toISOString();
}

/** Where someone is, from the path their open page reported (public/presence.js). */
function pageLabel(p: string | null, names: Map<string, string>) {
  if (!p) return "—";
  const path = p.split("#")[0];
  const rules: [RegExp, string][] = [
    [/^\/localizare/, "Localizator cadastral"], [/^\/amplasament/, "Analiza amplasamentului"], [/^\/comparabile/, "Localizator de comparabile"],
    [/^\/colaborari/, "Colaborări"], [/^\/instrumente/, "Instrumente"], [/^\/word/, "UVALO pentru Word"], [/^\/chrome/, "UVALO pentru Chrome"],
    [/^\/cont/, "Contul meu"], [/^\/firma/, "Firma mea"], [/^\/admin/, "Admin"], [/^\/$/, "Acasă"],
  ];
  const hit = rules.find(([r]) => r.test(path));
  const m = path.startsWith("/localizare") && p.includes("#") ? decodeURIComponent(p.split("#")[1]).match(/^([a-z-]+?)(?:-(\d+))?$/) : null;
  const uat = m ? [names.get(m[1]) ?? m[1], m[2] ? `nr. ${m[2]}` : ""].filter(Boolean).join(" · ") : "";
  return (hit ? hit[1] : path) + (uat ? ` (${uat})` : "");
}

export const metadata: Metadata = { title: "Panou | UVALO Admin" };
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
  // online: a presence signal in the last 3 minutes (one row per device; grouped per person)
  const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const [{ results: live }, recent] = await Promise.all([
    db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.anevar_no, s.last_page, s.last_seen_at, s.user_agent, s.city
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.revoked_at IS NULL AND s.last_seen_at > ? ORDER BY s.last_seen_at DESC LIMIT 200`)
      .bind(ago(3)).all<{ id: string; name: string; anevar_no: string | null; last_page: string | null; last_seen_at: string; user_agent: string | null; city: string | null }>(),
    db.prepare("SELECT COUNT(DISTINCT user_id) AS m15, (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE last_seen_at > ?2) AS today FROM sessions WHERE last_seen_at > ?1")
      .bind(ago(15), dayStartRo()).first<{ m15: number; today: number }>(),
  ]);
  const online = [...new Map(live.map((r) => [r.id, r])).values()];
  const uatNames = new Map((online.some((o) => o.last_page?.startsWith("/localizare#")) ? await uatList(new Request("https://uvalo.local/")).catch(() => []) : []).map((u) => [u.key, u.name]));
  const pct = k && k.members ? Math.round((k.with_account / k.members) * 1000) / 10 : 0;
  const countyOf = await countyOfUats();
  const mnt = await maintenance(db);
  return (
    <AdminShell c={c} active="panou" pending={pending} title="Panou" subtitle={k?.tablou ? `Tablou ANEVAR la ${fmtDate(k.tablou)}` : undefined}>
      <AdminInstall />
      <MaintenanceCard on={mnt.on} message={mnt.message} placeholder={DEFAULT_MESSAGE} />
      <div className="kpis admKpis">
        <div className="kpi"><small>Online acum</small><b>{online.length}</b></div>
        <div className="kpi"><small>Membri în tablou</small><b>{(k?.members ?? 0).toLocaleString("ro-RO")}</b></div>
        <div className="kpi"><small>Cu cont activ</small><b>{k?.with_account ?? 0} <span className="muted" style={{ fontSize: 13 }}>· {pct}%</span></b></div>
        <div className="kpi"><small>Solicitări în așteptare</small><b>{pending}</b></div>
        <div className="kpi"><small>Autentificați · 7 zile</small><b>{k?.login7 ?? 0}</b></div>
        <div className="kpi"><small>Activi · 30 zile</small><b>{k?.active30 ?? 0}</b></div>
      </div>
      <section className="card">
        <div className="cardHead">
          <h2>Online acum</h2>
          <span className={`pill ${online.length ? "pillOk" : ""}`}><i />{online.length === 1 ? "1 persoană" : `${online.length} persoane`}</span>
        </div>
        <p className="hint">Activi în ultimele 3 minute (pagina deschisă și vizibilă). În ultimele 15 minute: <b>{recent?.m15 ?? 0}</b> · azi: <b>{recent?.today ?? 0}</b>.</p>
        {online.length > 0 && (
          <ul className="docList">
            {online.map((o) => (
              <li key={o.id}>
                <span className="who"><b>{o.name}{o.id === c.user.id ? " (tu)" : ""}</b><small>{[pageLabel(o.last_page, uatNames), device(o.user_agent), o.city].filter(Boolean).join(" · ")}</small></span>
                <a className="link" href={`/admin/activitate?user=${o.id}`}>Activitate</a>
              </li>
            ))}
          </ul>
        )}
      </section>
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
      <UatCountTable title="Localități cele mai folosite (30 de zile)" rows={uats} countyOf={countyOf} empty="Nicio localitate deschisă încă." />
    </AdminShell>
  );
}
