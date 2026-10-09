import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { listRequests, SPEC_LABEL } from "@/lib/requests";
import { AdminShell } from "@/components/AdminShell";
import { RequestActions } from "@/components/admin";

export const metadata: Metadata = { title: "Solicitări | UVALO Admin" };
export const dynamic = "force-dynamic";

export default async function Requests() {
  const { db, c, pending } = await superPage();
  const [open, done, { results: plans }, { results: firms }] = await Promise.all([
    listRequests(db, "pending"), listRequests(db, "done"),
    db.prepare("SELECT id, name FROM plans WHERE active = 1 ORDER BY sort").all<{ id: string; name: string }>(),
    db.prepare(`SELECT o.id, o.name, o.seats, (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'active') AS used FROM orgs o
      WHERE o.status = 'active' AND o.seats > 1 ORDER BY o.name`).all<{ id: string; name: string; seats: number; used: number }>(),
  ]);
  const until = ""; // platform free for now: approved accounts have no end date (can still be set per request)
  return (
    <AdminShell c={c} active="solicitari" pending={pending} title="Solicitări de cont" subtitle="Evaluatori care au cerut cont cu legitimația ANEVAR">
      {open.length === 0 ? <div className="card"><p className="hint">Nicio solicitare în așteptare.</p></div> : open.map((r) => (
        <div key={r.id} className="reqCard">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <b style={{ fontSize: 16 }}>{r.name}</b>
            <span className="muted">Legitimație ANEVAR <b className="mono">{r.legit}</b>{r.county ? ` · ${r.county}` : ""}{r.in_current === 0 ? " · nu mai apare în tabloul curent" : ""}</span>
            {r.specs && <div className="specs">{r.specs.split(",").map((s) => <span key={s} className="spec" title={SPEC_LABEL[s]}>{s}</span>)}</div>}
            <span>{r.email}{r.phone ? ` · ${r.phone}` : ""}{r.company ? ` · ${r.company}` : ""}</span>
            {r.message && <p className="prose" style={{ margin: 0 }}>{r.message}</p>}
            {r.ref_by && <span className="pill pillWarn" style={{ alignSelf: "flex-start" }}>Recomandat de {r.ref_by}</span>}
            <span className="muted" style={{ fontSize: 12 }}>Trimisă {fmtDate(r.created_at, true)}</span>
          </div>
          <RequestActions id={r.id} name={r.name} plans={plans} firms={firms} until={until} />
        </div>
      ))}
      <section className="card flush">
        <div className="cardHead"><h2>Istoric</h2></div>
        {done.length === 0 ? <p className="hint pad">Nicio solicitare procesată încă.</p> : (
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Evaluator</th><th>Email</th><th>Trimisă</th><th>Decizie</th><th>De către</th></tr></thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id}>
                    <td><b className="block">{r.name}</b><span className="muted">leg. {r.legit}{r.county ? ` · ${r.county}` : ""}</span></td>
                    <td>{r.email}</td>
                    <td>{fmtDate(r.created_at, true)}</td>
                    <td><span className={`pill ${r.status === "approved" ? "pillOk" : "pillErr"}`}><i />{r.status === "approved" ? "Aprobată" : "Respinsă"}</span>{r.decision_note && <span className="muted block">{r.decision_note}</span>}</td>
                    <td>{r.decided_by_name ?? "—"}<span className="muted block">{fmtDate(r.decided_at, true)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
