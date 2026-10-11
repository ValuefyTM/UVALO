import type { Metadata } from "next";
import { superPage } from "@/lib/guard";
import { TOOLS, toolSettings, toolUsage } from "@/lib/tools";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = { title: "Instrumente | UVALO Admin" };
export const dynamic = "force-dynamic";

/** The tools of the platform: state, use in the last 30 days, link to the settings of each. */
export default async function Instrumente() {
  const { db, c, pending } = await superPage();
  const [{ off }, ...uses] = await Promise.all([toolSettings(db), ...TOOLS.map((t) => toolUsage(db, t.key))]);
  return (
    <AdminShell c={c} active="instrumente" pending={pending} title="Instrumente" subtitle="Setări și statistici pentru fiecare instrument">
      <div className="cols">
        {TOOLS.map((t, i) => {
          const on = !off.includes(t.key), u = uses[i];
          return (
            <section key={t.key} className="card">
              <div className="cardHead">
                <h2>{t.name}</h2>
                <span className={`pill ${on ? "pillOk" : "pillWarn"}`}><i />{on ? "Activ" : "Dezactivat"}</span>
              </div>
              <p className="hint">{t.desc}</p>
              <div className="kpis">
                <div className="kpi"><small>Utilizatori · 30 zile</small><b>{u.k.users}</b></div>
                <div className="kpi"><small>Acțiuni · 30 zile</small><b>{u.k.n.toLocaleString("ro-RO")}</b></div>
              </div>
              <div className="actions" style={{ justifyContent: "flex-start" }}>
                <a className="btn btnNavy btnSm" href={`/admin/instrumente/${t.key}`}>Setări și statistici →</a>
                <a className="link" href={t.href} style={{ fontSize: 13 }}>Deschide instrumentul</a>
              </div>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
