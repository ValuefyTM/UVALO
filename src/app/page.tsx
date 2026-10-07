import type { Metadata } from "next";
import { fmtDate, page } from "@/lib/guard";
import { MODULES } from "@/lib/access";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: "VALUEFY Tools" };
export const dynamic = "force-dynamic";

export default async function Home() {
  const { c } = await page();
  const first = c.user.name ? c.user.name.split(" ")[0] : "";
  const org = c.org;
  return (
    <AppShell c={c} active="home" title={`Bună${first ? `, ${first}` : ""}!`} subtitle={org ? `${org.name} · abonament ${org.plan_name}` : c.super ? "Administrator VALUEFY" : undefined}>
      {c.block && !c.super && <div className="note">{c.block} Scrie-ne la <a className="rowLink" href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să reactivăm accesul.</div>}
      {org && !c.block && org.valid_until && <p className="hint">Acces activ până la {fmtDate(org.valid_until)} · {org.seats} {org.seats === 1 ? "loc" : "locuri"}</p>}
      <div className="tools">
        {MODULES.map((m) => {
          const on = c.modules.includes(m.key);
          return on ? (
            <a key={m.key} className="tool" href={m.href}>
              <span className="eyebrow">Disponibil</span>
              <h2>{m.name}</h2>
              <p>{m.desc}</p>
              <span className="go">Deschide →</span>
            </a>
          ) : (
            <div key={m.key} className="tool off">
              <span className="eyebrow">Nu e inclus</span>
              <h2>{m.name}</h2>
              <p>{m.desc}</p>
            </div>
          );
        })}
        <div className="tool off">
          <span className="eyebrow">În curând</span>
          <h2>Analize de piață</h2>
          <p>Prețuri de ofertă și tranzacții pe zone, comparabile și tendințe, direct pentru rapoartele de evaluare.</p>
        </div>
      </div>
    </AppShell>
  );
}
