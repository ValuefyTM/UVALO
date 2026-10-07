import type { Metadata } from "next";
import { fmtDate, superPage } from "@/lib/guard";
import { byCounty, CONT_FILTERS, counties, PAGE_SIZE, SPECS, tablou, type TablouFilter } from "@/lib/tablou";
import { SPEC_LABEL } from "@/lib/requests";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = { title: "Tablou ANEVAR | VALUEFY Tools Admin" };
export const dynamic = "force-dynamic";

function status(r: { user_status: string | null; last_seen_at: string | null; request: string | null }): [string, string] {
  if (r.user_status === "active") return r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 30 * 864e5 ? ["Activ", "pillOk"] : ["Cont, inactiv", "pillWarn"];
  if (r.user_status === "invited") return ["Invitat", "pillWarn"];
  if (r.user_status === "disabled") return ["Dezactivat", "pillErr"];
  if (r.request === "pending") return ["Solicitare", "pillInfo"];
  if (r.request === "rejected") return ["Respins", "pillErr"];
  return ["Fără cont", ""];
}

export default async function Tablou({ searchParams }: { searchParams: Promise<TablouFilter> }) {
  const { db, c, pending } = await superPage();
  const f = await searchParams;
  const [list, sum, js] = await Promise.all([tablou(db, f), byCounty(db, f), counties(db)]);
  const qs = (o: Partial<TablouFilter>) => {
    const u = new URLSearchParams(Object.entries({ ...f, ...o }).filter(([, v]) => v) as [string, string][]);
    return `?${u.toString()}`;
  };
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const tot = sum.reduce((a, s) => ({ m: a.m + s.members, a: a.a + (s.accounts ?? 0), x: a.x + (s.active ?? 0) }), { m: 0, a: 0, x: 0 });
  const date = list.rows[0]?.tablou_date;
  return (
    <AdminShell c={c} active="tablou" pending={pending} title="Tablou ANEVAR" subtitle={`Membri titulari${date ? ` · tabloul la ${fmtDate(date)}` : ""} · cine are cont și cine se autentifică`}
      actions={<a className="btn btnGhost btnSm" href={`/api/admin/tablou${qs({ page: "" })}`}>Descarcă CSV</a>}>
      <form className="card filters" method="get">
        <label className="field grow">Caută<input className="input" name="q" defaultValue={f.q ?? ""} placeholder="Nume sau nr. legitimație" /></label>
        <label className="field">Județ
          <select className="select" name="judet" defaultValue={f.judet ?? ""}>
            <option value="">Toate județele</option>
            {js.map((j) => <option key={j.county} value={j.county}>{j.county} ({j.n})</option>)}
          </select>
        </label>
        <label className="field">Specializare
          <select className="select" name="spec" defaultValue={f.spec ?? ""}>
            <option value="">Toate</option>
            {SPECS.map((s) => <option key={s} value={s}>{s} · {SPEC_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field">Cont
          <select className="select" name="cont" defaultValue={f.cont ?? ""}>{CONT_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field">Ordonează
          <select className="select" name="sort" defaultValue={f.sort ?? ""}>
            <option value="">Nume</option><option value="judet">Județ</option><option value="login">Ultima activitate</option><option value="legit">Nr. legitimație</option>
          </select>
        </label>
        <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="vechi" value="1" defaultChecked={f.vechi === "1"} />Și cei care nu mai apar în tablou</label>
        <button type="submit" className="btn btnNavy">Filtrează</button>
        {Object.values(f).some(Boolean) && <a className="btn btnGhost" href="/admin/tablou">Resetează</a>}
      </form>

      <div className="kpis">
        <div className="kpi"><small>Membri {f.judet ? `· ${f.judet}` : "(filtrul curent)"}</small><b>{list.total.toLocaleString("ro-RO")}</b></div>
        <div className="kpi"><small>Cu cont activ (toate județele)</small><b>{tot.a} <span className="muted" style={{ fontSize: 13 }}>· {tot.m ? Math.round((tot.a / tot.m) * 1000) / 10 : 0}%</span></b></div>
        <div className="kpi"><small>Activi 30 zile (toate județele)</small><b>{tot.x}</b></div>
      </div>

      <section className="card flush">
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Legitimație</th><th>Nume</th><th>Județ</th><th>Specializări</th><th>Cont</th><th>Ultima activitate</th><th className="r">Acțiuni 30 zile</th></tr></thead>
            <tbody>
              {list.rows.map((r) => {
                const [t, cls] = status(r);
                return (
                  <tr key={r.legit}>
                    <td className="mono">{r.legit}</td>
                    <td><b className="block">{r.name}</b>{r.email && <span className="muted">{r.email}</span>}{!r.in_current && <span className="muted block">nu mai apare în tablou</span>}</td>
                    <td>{r.county ?? "—"}</td>
                    <td><div className="specs">{(r.specs ?? "").split(",").filter(Boolean).map((s) => <span key={s} className="spec" title={SPEC_LABEL[s]}>{s}</span>)}</div></td>
                    <td><span className={`pill ${cls}`}><i />{t}</span></td>
                    <td>{r.last_seen_at ? fmtDate(r.last_seen_at, true) : r.user_id ? "niciodată" : "—"}</td>
                    <td className="r mono">{r.user_id ? <a className="rowLink" href={`/admin/activitate?user=${r.user_id}`}>{r.events_30}</a> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span className="muted">{list.total ? `${(list.page - 1) * PAGE_SIZE + 1}–${Math.min(list.page * PAGE_SIZE, list.total)} din ${list.total.toLocaleString("ro-RO")}` : "Niciun membru pentru filtrul ales."}</span>
          <span className="actions">
            {list.page > 1 && <a className="btn btnGhost btnSm" href={qs({ page: String(list.page - 1) })}>← Înapoi</a>}
            {list.page < pages && <a className="btn btnGhost btnSm" href={qs({ page: String(list.page + 1) })}>Înainte →</a>}
          </span>
        </div>
      </section>

      <section className="card flush">
        <div className="cardHead"><h2>Pe județe</h2><span className="muted">cu filtrele de mai sus, fără județ</span></div>
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Județ</th><th className="r">Membri</th><th className="r">Cu cont</th><th className="r">Acoperire</th><th className="r">Activi 30 zile</th></tr></thead>
            <tbody>
              {sum.map((s) => (
                <tr key={s.county ?? "—"}>
                  <td><a className="rowLink" href={qs({ judet: s.county ?? "", page: "" })}>{s.county ?? "—"}</a></td>
                  <td className="r mono">{s.members}</td>
                  <td className="r mono">{s.accounts ?? 0}</td>
                  <td className="r mono">{s.members ? `${Math.round(((s.accounts ?? 0) / s.members) * 1000) / 10}%` : "—"}</td>
                  <td className="r mono">{s.active ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
