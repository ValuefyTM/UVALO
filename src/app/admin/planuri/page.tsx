import type { Metadata } from "next";
import { superPage } from "@/lib/guard";
import { githubReady, listUploads, refresh, uats } from "@/lib/plans";
import { AdminShell } from "@/components/AdminShell";
import { PlanList, PlanUploader } from "@/components/plans";
import { roDate } from "@/lib/plan-format";

export const metadata: Metadata = { title: "Planuri cadastrale | VALUEFY Tools Admin" };
export const dynamic = "force-dynamic";

export default async function Planuri() {
  const { db, c, pending } = await superPage();
  await refresh(db).catch(() => null);
  const [list, uploads, ready] = await Promise.all([uats(new Request("https://tools.local/")), listUploads(db), githubReady()]);
  const counties = new Set(list.map((u) => u.county)).size;
  const parcels = list.reduce((s, u) => s + u.n, 0);
  return (
    <AdminShell c={c} active="planuri" pending={pending} title="Planuri cadastrale" subtitle={`Localizatorul: ${counties === 1 ? "1 județ" : `${counties} județe`} · ${list.length} UAT-uri · ${parcels.toLocaleString("ro-RO")} imobile`}>
      <div className="cols">
        <PlanUploader uats={list} ready={ready} />
        <PlanList initial={uploads} />
      </div>
      <section className="card">
        <h2>UAT-uri în localizator</h2>
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>UAT</th><th>Imobile</th><th>Construcții</th><th>Date cadastrale la</th></tr></thead>
            {[...new Set(list.map((u) => u.county))].map((county) => {
              const rows = list.filter((u) => u.county === county);
              return (
                <tbody key={county}>
                  <tr className="groupRow"><td>Județul {county} · {rows.length} UAT-uri</td><td>{rows.reduce((s, u) => s + u.n, 0).toLocaleString("ro-RO")}</td><td>{rows.reduce((s, u) => s + (u.nb ?? 0), 0).toLocaleString("ro-RO")}</td><td /></tr>
                  {rows.map((u) => (
                    <tr key={u.key}>
                      <td><b>{u.name}</b></td>
                      <td>{u.n.toLocaleString("ro-RO")}</td>
                      <td>{(u.nb ?? 0).toLocaleString("ro-RO")}</td>
                      <td>{u.date ? roDate(u.date) : <span className="muted">plan DWG inițial</span>}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
