import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { listReferrals, stage } from "@/lib/referrals";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = { title: "Recomandări | VALUEFY Tools Admin" };
export const dynamic = "force-dynamic";

/** Who recommended whom, and how far each colleague got (link opened → request → approval → active account). */
export default async function Referrals() {
  const { db, c, pending } = await superPage();
  const rows = await listReferrals(db);
  const n = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
  const requested = n((r) => !!r.req_status), active = n((r) => !!r.activated_at || r.user_status === "active");
  const top = Object.values(rows.reduce<Record<string, { name: string; legit: string | null; sent: number; req: number; on: number }>>((acc, r) => {
    const t = (acc[r.by_id] ??= { name: r.by_name, legit: r.by_legit, sent: 0, req: 0, on: 0 });
    t.sent++; if (r.req_status) t.req++; if (r.activated_at || r.user_status === "active") t.on++;
    return acc;
  }, {})).sort((a, b) => b.on - a.on || b.req - a.req || b.sent - a.sent).slice(0, 10);
  const pct = (x: number) => (rows.length ? ` · ${Math.round((x / rows.length) * 100)}%` : "");
  return (
    <AdminShell c={c} active="recomandari" pending={pending} title="Recomandări" subtitle="Cine a recomandat aplicația cui și ce s-a întâmplat cu invitația">
      <div className="kpis">
        <div className="kpi"><small>Recomandări trimise</small><b>{rows.length}</b></div>
        <div className="kpi"><small>Au deschis linkul</small><b>{n((r) => !!r.opened_at || !!r.req_status)}<span className="muted" style={{ fontSize: 13 }}>{pct(n((r) => !!r.opened_at || !!r.req_status))}</span></b></div>
        <div className="kpi"><small>Au solicitat cont</small><b>{requested}<span className="muted" style={{ fontSize: 13 }}>{pct(requested)}</span></b></div>
        <div className="kpi"><small>Conturi active</small><b>{active}<span className="muted" style={{ fontSize: 13 }}>{pct(active)}</span></b></div>
      </div>

      <section className="card flush">
        <div className="cardHead" style={{ padding: "16px 22px 0" }}><h2>Toate recomandările</h2></div>
        {rows.length === 0 ? <p className="hint" style={{ padding: "0 22px 18px" }}>Nicio recomandare încă. Utilizatorii recomandă din cardul „Recomandă unui coleg” din meniu.</p> : (
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Data</th><th>Recomandat de</th><th>Coleg invitat</th><th>Stadiu</th><th>Ultimul pas</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const [t, cls] = stage(r);
                  const lastStep = r.activated_at ?? r.decided_at ?? r.req_at ?? r.opened_at;
                  return (
                    <tr key={r.id}>
                      <td className="muted">{fmtDate(r.created_at, true)}</td>
                      <td><b>{r.by_name}</b><div className="muted">{r.by_legit ? `Legitimație ${r.by_legit}` : r.by_email}</div></td>
                      <td>
                        <b>{r.req_name || r.name || r.email}</b>
                        <div className="muted">{r.email}{r.req_legit ? ` · legitimație ${r.req_legit}` : ""}</div>
                        {r.note && <div className="muted" style={{ fontStyle: "italic" }}>„{r.note}”</div>}
                      </td>
                      <td><span className={`pill ${cls}`}><i />{t}</span></td>
                      <td className="muted">{lastStep ? fmtDate(lastStep, true) : "—"}{r.last_seen_at && (r.activated_at || r.user_status === "active") ? <div>văzut {fmtDate(r.last_seen_at, true)}</div> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {top.length > 0 && (
        <section className="card flush">
          <div className="cardHead" style={{ padding: "16px 22px 0" }}><h2>Cei care recomandă cel mai mult</h2></div>
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Utilizator</th><th className="r">Recomandări</th><th className="r">Au solicitat cont</th><th className="r">Conturi active</th></tr></thead>
              <tbody>{top.map((t) => <tr key={t.name + t.legit}><td><b>{t.name}</b>{t.legit ? <span className="muted"> · {t.legit}</span> : null}</td><td className="r">{t.sent}</td><td className="r">{t.req}</td><td className="r">{t.on}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
