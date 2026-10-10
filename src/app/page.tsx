import type { Metadata } from "next";
import { firstName, page } from "@/lib/guard";
import { uats } from "@/lib/cadastre";
import { AppShell } from "@/components/AppShell";
import { CollabIcon, ComparablesBand, LocatorBand, MarketIcon, SiteBand } from "@/components/Art";
import { NotifyButton } from "@/components/NotifyButton";
import { QuickSearch } from "@/components/QuickSearch";
import { Referral } from "@/components/Referral";

export const metadata: Metadata = { title: "UVALO" };
export const dynamic = "force-dynamic";

const TOOLS = [
  { key: "localizare", href: "/localizare", name: "Localizator cadastral", desc: "Parcele, Stereo 70, fișă PDF", Band: LocatorBand, isNew: false },
  { key: "amplasament", href: "/amplasament", name: "Analiza amplasamentului", desc: "Fișa amplasamentului și textul pentru raport, cu AI", Band: SiteBand, isNew: true },
  { key: "comparabile", href: "/comparabile", name: "Comparabile", desc: "Subiectul și comparabilele pe hartă, cu distanțe", Band: ComparablesBand, isNew: true },
];
const SOON = [
  { key: "analize", Icon: MarketIcon, name: "Analize de piață", desc: "Prețuri, tranzacții, tendințe" },
  { key: "colaborari", Icon: CollabIcon, name: "Colaborări", desc: "Inspecții, angajări, proiecte" },
];

const TZ = "Europe/Bucharest";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
/** "azi", "ieri" or "8 oct." */
function when(at: string) {
  const d = new Date(at), now = new Date();
  if (dayKey(d) === dayKey(now)) return "azi";
  if (dayKey(d) === dayKey(new Date(now.getTime() - 864e5))) return "ieri";
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short", timeZone: TZ });
}

export default async function Home() {
  const { db, c } = await page();
  const first = await firstName(db, c.user.name, c.user.anevar_no);
  const loc = c.modules.includes("localizare");
  const day = new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const sub = [day.charAt(0).toUpperCase() + day.slice(1), c.user.county].filter(Boolean).join(" · ");

  // The locator's plans (for the search bar and the totals) and the parcels this person opened last.
  const list = loc ? await uats(new Request("https://uvalo.local/")).catch(() => []) : [];
  const parcels = list.reduce((s, u) => s + u.n, 0);
  const counties = [...new Set(list.map((u) => u.county).filter(Boolean))];
  const keyOf = new Map(list.map((u) => [u.name, u.key]));
  const recent: { nr: string; uat: string; area: number | null; at: string; href: string }[] = [];
  if (loc) {
    const { results } = await db.prepare("SELECT target, meta, at FROM events WHERE user_id = ? AND module = 'localizare' AND action = 'parcel' AND target IS NOT NULL ORDER BY id DESC LIMIT 60")
      .bind(c.user.id).all<{ target: string; meta: string | null; at: string }>();
    for (const e of results) {
      let m: { uat?: string; a?: number | null } = {};
      try { m = JSON.parse(e.meta ?? "{}"); } catch {}
      const key = m.uat ? keyOf.get(m.uat) : undefined;
      if (!key || recent.some((r) => r.nr === e.target && r.uat === m.uat)) continue;
      recent.push({ nr: e.target, uat: m.uat!, area: typeof m.a === "number" ? m.a : null, at: e.at, href: `/localizare#${key}-${encodeURIComponent(e.target)}` });
      if (recent.length === 5) break;
    }
  }
  const asked = new Set((await db.prepare("SELECT DISTINCT target FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify'").bind(c.user.id).all<{ target: string }>()).results.map((r) => r.target));

  return (
    <AppShell c={c} active="home" title={`Bună${first ? `, ${first}` : ""}!`} subtitle={sub}>
      {c.block && !c.super && <div className="note">{c.block} Scrie-ne la <a className="rowLink" href="mailto:office@valuefy.ro">office@valuefy.ro</a> ca să reactivăm accesul.</div>}

      <div className="home">
        <section className="homeWork" aria-label="Caută un imobil">
          {loc ? (
            <>
              <QuickSearch uats={list.map((u) => ({ key: u.key, name: u.name, county: u.county ?? "Timiș" }))} amp={c.modules.includes("amplasament")} />
              <h2 className="homeSec">Ultimele imobile căutate</h2>
              {recent.length ? (
                <ul className="recent">
                  {recent.map((r) => (
                    <li key={r.href}>
                      <a href={r.href}>
                        <span className="recentPin" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" fill="currentColor" /></svg></span>
                        <b>{r.nr}</b>
                        <span className="recentMeta">{[r.uat, r.area != null ? `${r.area.toLocaleString("ro-RO")} mp` : null, when(r.at)].filter(Boolean).join(" · ")}</span>
                        <span className="recentGo">Deschide →</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="recentEmpty">Imobilele pe care le deschizi în localizator apar aici, ca să revii la ele dintr-un click.</p>
              )}
              {parcels > 0 && <p className="homeTotals">{parcels.toLocaleString("ro-RO")} imobile în {counties.length === 1 ? counties[0] : `${counties.length} județe`} · {list.length} UAT</p>}
            </>
          ) : (
            <p className="recentEmpty">Abonamentul firmei tale nu include localizatorul cadastral.</p>
          )}
        </section>

        <aside className="homeSide" aria-label="Instrumente">
          {TOOLS.map(({ key, href, name, desc, Band, isNew }) => {
            const on = c.modules.includes(key);
            const body = (
              <>
                <Band />
                <div className="toolBody">
                  <h3>{name}{isNew && <span className="newTag">Nou</span>}</h3>
                  <p>{desc}</p>
                  <div className="toolFoot">
                    <span className={on ? "avail" : "avail no"}>{on ? "Disponibil" : "Nu e inclus"}</span>
                    {on && <span className="go">Deschide →</span>}
                  </div>
                </div>
              </>
            );
            return on ? <a key={key} className="toolCard" href={href}>{body}</a> : <div key={key} className="toolCard off">{body}</div>;
          })}
          <h2 className="homeSec">În curând</h2>
          {SOON.map(({ key, Icon, name, desc }) => (
            <div key={key} className="soonCard">
              <Icon />
              <div className="soonText"><h3>{name}</h3><p>{desc}</p></div>
              <NotifyButton k={key} done={asked.has(key)} />
            </div>
          ))}
        </aside>
      </div>

      <div className="mobileOnly" style={{ marginTop: 16 }}><Referral variant="card" /></div>
    </AppShell>
  );
}
