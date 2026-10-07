import type { Metadata } from "next";
import { fmtDate, page } from "@/lib/guard";
import { MODULES } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { CollabArt, LocatorArt } from "@/components/Art";
import { Referral } from "@/components/Referral";

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
            <a key={m.key} className="tool withArt" href={m.href}>
              {m.key === "localizare" && <LocatorArt />}
              <span className="eyebrow">Disponibil</span>
              <h2>{m.name}</h2>
              <p>{m.desc}</p>
              <span className="go">Deschide →</span>
            </a>
          ) : (
            <div key={m.key} className="tool withArt off">
              {m.key === "localizare" && <LocatorArt />}
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
        <div className="mobileOnly"><Referral variant="card" /></div>
      </div>

      <section className="announce">
        <CollabArt />
        <div className="announceText">
          <span className="eyebrow">În curând · Portal de colaborări</span>
          <h2>Colaborări între evaluatori, direct în VALUEFY Tools</h2>
          <p>Pregătim un spațiu în care evaluatorii autorizați ANEVAR lucrează împreună:</p>
          <ul>
            <li><b>Cereri de inspecție</b>: ai un dosar în alt oraș sau județ? Ceri unui coleg de acolo să facă inspecția.</li>
            <li><b>Anunțuri de angajare</b>: birourile își găsesc evaluatori, iar evaluatorii își găsesc echipa.</li>
            <li><b>Colaborări pe proiecte</b>: portofolii mari, verificări, specializări pe care nu le ai în birou.</li>
          </ul>
          <p className="muted">Te anunțăm pe email când se deschide. Între timp, recomandă aplicația colegilor: cu cât suntem mai mulți, cu atât găsești mai ușor un partener.</p>
        </div>
      </section>
    </AppShell>
  );
}
