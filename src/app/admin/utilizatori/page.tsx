import type { Metadata } from "next";
import { Fragment } from "react";
import { fmtDate, superPage } from "@/lib/guard";
import { ROLE_LABEL, type Role } from "@/lib/access";
import { AdminShell } from "@/components/AdminShell";
import { InviteAdmin, MergeUsers, UserActions } from "@/components/forms";

export const metadata: Metadata = { title: "Utilizatori | UVALO" };
export const dynamic = "force-dynamic";

type F = { q?: string; judet?: string; stare?: string; tip?: string; firma?: string; act?: string; sort?: string; grup?: string };
const STARE: [string, string][] = [["", "Toate"], ["active", "Active"], ["invited", "Invitate"], ["disabled", "Dezactivate"], ["closed", "Au renunțat"]];
const TIP: [string, string][] = [["", "Toți"], ["legit", "Cu legitimație ANEVAR"], ["fara", "Fără legitimație"], ["admin", "Administratori UVALO"], ["birou", "Cu funcția de birou"], ["birou_cerut", "Au cerut funcția de birou"]];
const FIRMA: [string, string][] = [["", "Oricare"], ["cu", "Într-o firmă"], ["fara", "Fără firmă"]];
const ACT: [string, string][] = [["", "Oricând"], ["online", "Online acum"], ["7", "Activi în ultimele 7 zile"], ["30", "Activi în ultimele 30 de zile"], ["inactivi", "Inactivi 30 de zile"], ["niciodata", "Niciodată autentificați"]];
const SORT: [string, string][] = [["", "Ultima activitate"], ["nume", "Nume"], ["judet", "Județ"], ["nou", "Cele mai noi conturi"], ["actiuni", "Acțiuni 30 zile"]];

const STATUS: Record<string, [string, string]> = { active: ["Activ", "pillOk"], invited: ["Invitat", "pillWarn"], disabled: ["Dezactivat", "pillErr"], closed: ["A renunțat", "pillMuted"] };

const since = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export default async function AdminUsers({ searchParams }: { searchParams: Promise<F> }) {
  const { db, c, pending } = await superPage();
  const f = await searchParams;
  const w: string[] = [], p: unknown[] = [];
  const q = (f.q ?? "").trim();
  if (q) { w.push("(u.name LIKE ? OR u.email LIKE ? OR u.anevar_no LIKE ? OR u.phone LIKE ?)"); const l = `%${q.replace(/[%_]/g, "")}%`; p.push(l, l, `${q}%`, l); }
  if (f.judet === "-") w.push("u.county IS NULL"); else if (f.judet) { w.push("u.county = ?"); p.push(f.judet); }
  if (f.stare && ["active", "invited", "disabled", "closed"].includes(f.stare)) { w.push("u.status = ?"); p.push(f.stare); }
  if (f.tip === "legit") w.push("u.anevar_no IS NOT NULL AND u.anevar_no <> ''");
  if (f.tip === "fara") w.push("(u.anevar_no IS NULL OR u.anevar_no = '')");
  if (f.tip === "admin") w.push("u.is_superadmin = 1");
  if (f.tip === "birou") w.push("u.office_allowed = 1");
  if (f.tip === "birou_cerut") w.push("EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.module = 'home' AND e.action = 'notify' AND e.target = 'birou')");
  const inFirm = "EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.status = 'active')";
  if (f.firma === "cu") w.push(inFirm);
  else if (f.firma === "fara") w.push(`NOT ${inFirm}`);
  else if (f.firma) { w.push("EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.status = 'active' AND m.org_id = ?)"); p.push(f.firma); }
  switch (f.act) {
    case "online": w.push("EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.last_seen_at > ?)"); p.push(new Date(Date.now() - 3 * 60_000).toISOString()); break;
    case "7": w.push("u.last_seen_at > ?"); p.push(since(7)); break;
    case "30": w.push("u.last_seen_at > ?"); p.push(since(30)); break;
    case "inactivi": w.push("u.status = 'active' AND (u.last_seen_at IS NULL OR u.last_seen_at <= ?)"); p.push(since(30)); break;
    case "niciodata": w.push("u.last_login_at IS NULL"); break;
  }
  const where = w.length ? `WHERE ${w.join(" AND ")}` : "";
  const inner = f.sort === "nume" ? "COALESCE(NULLIF(u.name, ''), u.email) COLLATE NOCASE" : f.sort === "nou" ? "u.created_at DESC" : f.sort === "actiuni" ? "events_30 DESC" : f.sort === "judet" ? "u.county IS NULL, u.county, u.name" : "u.status = 'active' DESC, u.last_seen_at IS NULL, u.last_seen_at DESC, u.created_at DESC";
  const order = f.grup === "judet" ? `u.county IS NULL, u.county, ${inner}` : inner;

  const [{ results }, { results: all }, { results: js }, { results: firms }] = await Promise.all([
    db.prepare(`SELECT u.id, u.email, u.name, u.anevar_no, u.county, u.status, u.is_superadmin, u.office_allowed, u.is_office, u.last_seen_at, u.created_at, u.activated_at, u.closed_at, u.close_reason,
        (SELECT GROUP_CONCAT(o.name || '|' || m.role || '|' || o.id, ';;') FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active') AS orgs,
        (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id AND e.at > ?) AS events_30,
        (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > ?) AS devices
      FROM users u ${where} ORDER BY ${order} LIMIT 2000`)
      .bind(since(30), new Date().toISOString(), ...p)
      .all<{ id: string; email: string; name: string; anevar_no: string | null; county: string | null; status: string; is_superadmin: number; office_allowed: number; is_office: number; last_seen_at: string | null; created_at: string; activated_at: string | null; closed_at: string | null; close_reason: string | null; orgs: string | null; events_30: number; devices: number }>(),
    // every account, for "Unește două conturi" (not affected by the filters)
    db.prepare(`SELECT u.id, u.email, u.name, u.anevar_no, u.county, u.status, u.is_superadmin,
        (SELECT GROUP_CONCAT(o.name || '|' || m.role || '|' || o.id, ';;') FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active') AS orgs
      FROM users u ORDER BY u.name COLLATE NOCASE LIMIT 3000`)
      .all<{ id: string; email: string; name: string; anevar_no: string | null; county: string | null; status: string; is_superadmin: number; orgs: string | null }>(),
    db.prepare("SELECT COALESCE(county, '-') AS county, COUNT(*) AS n FROM users GROUP BY county ORDER BY county IS NULL, county").all<{ county: string; n: number }>(),
    db.prepare("SELECT o.id, o.name, COUNT(m.user_id) AS n FROM orgs o LEFT JOIN memberships m ON m.org_id = o.id AND m.status = 'active' GROUP BY o.id ORDER BY o.name COLLATE NOCASE").all<{ id: string; name: string; n: number }>(),
  ]);
  const filtered = Object.entries(f).some(([k, v]) => v && k !== "sort" && k !== "grup");
  const groupCount = new Map<string, number>();
  for (const u of results) groupCount.set(u.county ?? "", (groupCount.get(u.county ?? "") ?? 0) + 1);
  const sel = (name: keyof F, opts: [string, string][]) => (
    <select className="select" name={name} defaultValue={f[name] ?? ""}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  );

  return (
    <AdminShell c={c} active="utilizatori" pending={pending} title="Utilizatori" subtitle={filtered ? `${results.length} din ${all.length} conturi` : `${all.length} conturi`}>
      <section className="card">
        <InviteAdmin />
        <p className="hint">Utilizatorii firmelor se invită din pagina firmei. Aici inviți colegi care administrează platforma.</p>
      </section>
      <MergeUsers users={all} me={c.user.id} />

      <form className="card tabFilters" method="get">
        <label className="field grow">Caută<input className="input" name="q" defaultValue={f.q ?? ""} placeholder="Nume, email, telefon sau legitimație" /></label>
        <label className="field">Județ
          <select className="select" name="judet" defaultValue={f.judet ?? ""}>
            <option value="">Toate județele</option>
            {js.map((j) => <option key={j.county} value={j.county}>{j.county === "-" ? "Fără județ" : j.county} ({j.n})</option>)}
          </select>
        </label>
        <label className="field">Stare{sel("stare", STARE)}</label>
        <label className="field">Tip cont{sel("tip", TIP)}</label>
        <label className="field">Firmă
          <select className="select" name="firma" defaultValue={f.firma ?? ""}>
            {FIRMA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            {firms.length > 0 && <optgroup label="Firma">{firms.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.n})</option>)}</optgroup>}
          </select>
        </label>
        <label className="field">Activitate{sel("act", ACT)}</label>
        <label className="field">Ordonează{sel("sort", SORT)}</label>
        <div className="tfFoot">
          <label className="check"><input type="checkbox" name="grup" value="judet" defaultChecked={f.grup === "judet"} />Grupează pe județe</label>
          {Object.values(f).some(Boolean) && <a className="btn btnGhost" href="/admin/utilizatori">Resetează</a>}
          <button type="submit" className="btn btnNavy">Filtrează</button>
        </div>
      </form>

      <section className="card flush">
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Persoană</th><th>Firmă / rol</th><th>Stare</th><th>Ultima activitate</th><th className="r">Acțiuni 30 zile</th><th className="r">Dispozitive</th><th /></tr></thead>
            <tbody>
              {results.length === 0 && <tr><td colSpan={7} className="muted">Niciun cont pentru filtrele alese.</td></tr>}
              {results.map((u, i) => {
                const head = f.grup === "judet" && (i === 0 || results[i - 1].county !== u.county);
                return (
                  <Fragment key={u.id}>
                    {head && <tr className="groupRow"><td colSpan={7}>{u.county ?? "Fără județ"} · {groupCount.get(u.county ?? "") ?? 0} {groupCount.get(u.county ?? "") === 1 ? "cont" : "conturi"}</td></tr>}
                    <tr>
                      <td><b className="block">{u.name || u.email}</b><span className="muted">{u.email}{u.anevar_no ? ` · leg. ${u.anevar_no}` : ""}{u.county ? ` · ${u.county}` : ""}</span>{u.is_superadmin ? <span className="pill pillInfo" style={{ marginLeft: 8 }}><i />Admin UVALO</span> : null}{u.office_allowed ? <span className="pill pillWarn" style={{ marginLeft: 8 }}><i />Birou{u.is_office ? " activ" : " permis"}</span> : null}</td>
                      <td>{u.orgs ? u.orgs.split(";;").map((x) => { const [n, r, id] = x.split("|"); return <a key={id} className="rowLink block" href={`/admin/firme/${id}`}>{n} <span className="muted">· {ROLE_LABEL[r as Role] ?? r}</span></a>; }) : <span className="muted">—</span>}</td>
                      <td><span className={`pill ${STATUS[u.status]?.[1] ?? "pillWarn"}`}><i />{STATUS[u.status]?.[0] ?? u.status}</span>
                        {u.status === "closed" && <span className="muted block" style={{ marginTop: 4, fontSize: 12 }}>{u.closed_at ? fmtDate(u.closed_at) : ""}{u.close_reason ? ` · ${u.close_reason}` : ""}</span>}</td>
                      <td>{u.last_seen_at ? fmtDate(u.last_seen_at, true) : "—"}</td>
                      <td className="r mono"><a className="rowLink" href={`/admin/activitate?user=${u.id}`}>{u.events_30}</a></td>
                      <td className="r mono">{u.devices}</td>
                      <td className="r"><UserActions id={u.id} status={u.status} isSuper={!!u.is_superadmin} me={u.id === c.user.id} email={u.email} office={!!u.office_allowed} /></td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
