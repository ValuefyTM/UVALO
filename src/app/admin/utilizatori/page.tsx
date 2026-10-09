import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { ROLE_LABEL, type Role } from "@/lib/access";
import { AdminShell } from "@/components/AdminShell";
import { InviteAdmin, UserActions } from "@/components/forms";

export const metadata: Metadata = { title: "Utilizatori | UVALO" };
export const dynamic = "force-dynamic";

const since = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export default async function AdminUsers() {
  const { db, c, pending } = await superPage();
  const { results } = await db
    .prepare(`SELECT u.id, u.email, u.name, u.anevar_no, u.county, u.status, u.is_superadmin, u.last_seen_at, u.created_at, u.activated_at,
        (SELECT GROUP_CONCAT(o.name || '|' || m.role || '|' || o.id, ';;') FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active') AS orgs,
        (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id AND e.at > ?1) AS events_30,
        (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > ?2) AS devices
      FROM users u ORDER BY u.status = 'active' DESC, u.last_seen_at DESC, u.created_at DESC LIMIT 2000`)
    .bind(since(30), new Date().toISOString())
    .all<{ id: string; email: string; name: string; anevar_no: string | null; county: string | null; status: string; is_superadmin: number; last_seen_at: string | null; created_at: string; activated_at: string | null; orgs: string | null; events_30: number; devices: number }>();
  return (
    <AdminShell c={c} active="utilizatori" pending={pending} title="Utilizatori" subtitle={`${results.length} conturi`}>
      <section className="card">
        <InviteAdmin />
        <p className="hint">Utilizatorii firmelor se invită din pagina firmei. Aici inviți colegi care administrează platforma.</p>
      </section>
      <section className="card flush">
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Persoană</th><th>Firmă / rol</th><th>Stare</th><th>Ultima activitate</th><th className="r">Acțiuni 30 zile</th><th className="r">Dispozitive</th><th /></tr></thead>
            <tbody>
              {results.map((u) => (
                <tr key={u.id}>
                  <td><b className="block">{u.name || u.email}</b><span className="muted">{u.email}{u.anevar_no ? ` · leg. ${u.anevar_no}` : ""}{u.county ? ` · ${u.county}` : ""}</span>{u.is_superadmin ? <span className="pill pillInfo" style={{ marginLeft: 8 }}><i />Admin UVALO</span> : null}</td>
                  <td>{u.orgs ? u.orgs.split(";;").map((x) => { const [n, r, id] = x.split("|"); return <a key={id} className="rowLink block" href={`/admin/firme/${id}`}>{n} <span className="muted">· {ROLE_LABEL[r as Role] ?? r}</span></a>; }) : <span className="muted">—</span>}</td>
                  <td><span className={`pill ${u.status === "active" ? "pillOk" : u.status === "disabled" ? "pillErr" : "pillWarn"}`}><i />{u.status === "active" ? "Activ" : u.status === "disabled" ? "Dezactivat" : "Invitat"}</span></td>
                  <td>{u.last_seen_at ? fmtDate(u.last_seen_at, true) : "—"}</td>
                  <td className="r mono"><a className="rowLink" href={`/admin/activitate?user=${u.id}`}>{u.events_30}</a></td>
                  <td className="r mono">{u.devices}</td>
                  <td className="r"><UserActions id={u.id} status={u.status} isSuper={!!u.is_superadmin} me={u.id === c.user.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
