import type { Metadata } from "next";
import { firstName, page } from "@/lib/guard";
import { MODULES } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { CollabArt, LocatorArt, MarketArt } from "@/components/Art";
import { Referral } from "@/components/Referral";

export const metadata: Metadata = { title: "VALUEFY Tools" };
export const dynamic = "force-dynamic";

export default async function Home() {
  const { db, c } = await page();
  const first = await firstName(db, c.user.name, c.user.anevar_no);
  const org = c.org;
  // Only the firm's name, and only when it is not just the person's own name (individual accounts).
  const sub = org && org.name.trim().toLowerCase() !== c.user.name.trim().toLowerCase() ? org.name : c.super ? "Administrator VALUEFY" : undefined;
  return (
    <AppShell c={c} active="home" title={`Bună${first ? `, ${first}` : ""}!`} subtitle={sub}>
      {c.block && !c.super && <div className="note">{c.block} Scrie-ne la <a className="rowLink" href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să reactivăm accesul.</div>}
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
        <div className="tool withArt off">
          <MarketArt />
          <span className="eyebrow">În curând</span>
          <h2>Analize de piață</h2>
          <p>Date despre tranzacții, prețuri de ofertă și indici de piață pe zone, comparabile și tendințe, direct pentru rapoartele de evaluare.</p>
          <div className="toolTags"><span>Tranzacții</span><span>Prețuri de ofertă</span><span>Indici de piață</span><span>Comparabile</span><span>Tendințe</span></div>
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
