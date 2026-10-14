import type { Metadata } from "next";
import { firstName, page } from "@/lib/guard";
import { uats } from "@/lib/cadastre";
import { AppShell } from "@/components/AppShell";
import { CollabArt, CompsThumb, MarketArt, SiteThumb } from "@/components/Art";
import { NotifyButton } from "@/components/NotifyButton";
import { QuickSearch } from "@/components/QuickSearch";
import { Referral } from "@/components/Referral";
import { CollabHome, CollabLaunch } from "@/components/HomeCollab";
import { collabLaunch, collabState } from "@/lib/collab";

export const metadata: Metadata = { title: "UVALO" };
export const dynamic = "force-dynamic";

// Secondary tools (the cadastral locator is the main one, at the top) and the upcoming main modules.
const TOOLS = [
  { key: "amplasament", href: "/amplasament", name: "Analiza amplasamentului", desc: "Fișa zonei și textul pentru raport, din planul cadastral și OpenStreetMap", Thumb: SiteThumb },
  { key: "comparabile", href: "/comparabile", name: "Localizator de comparabile", desc: "Subiectul și comparabilele pe hartă, cu distanțe, gata de raport", Thumb: CompsThumb },
];
const SOON = [
  { key: "analize", Art: MarketArt, name: "Analize de piață", desc: "Prețuri, tranzacții și tendințe pe zone, pentru justificarea valorilor din raport." },
  { key: "colaborari", Art: CollabArt, name: "Colaborări", desc: "Inspecții, angajări și colaborări între evaluatori: cauți pe cineva pentru o inspecție sau oferi o colaborare, direct în platformă." },
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
  const amp = c.modules.includes("amplasament");
  const day = new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const sub = [day.charAt(0).toUpperCase() + day.slice(1), c.user.county].filter(Boolean).join(" · ");

  // The locator's plans (for the search bar and the totals) and the parcels this person opened last.
  const list = loc ? await uats(new Request("https://uvalo.local/")).catch(() => []) : [];
  const parcels = list.reduce((s, u) => s + u.n, 0);
  const counties = [...new Set(list.map((u) => u.county).filter(Boolean))];
  const keyOf = new Map(list.map((u) => [u.name, u.key]));
  const recent: { nr: string; uat: string; key: string; area: number | null; at: string; href: string }[] = [];
  if (loc) {
    const { results } = await db.prepare("SELECT target, meta, at FROM events WHERE user_id = ? AND module = 'localizare' AND action = 'parcel' AND target IS NOT NULL ORDER BY id DESC LIMIT 60")
      .bind(c.user.id).all<{ target: string; meta: string | null; at: string }>();
    for (const e of results) {
      let m: { uat?: string; a?: number | null } = {};
      try { m = JSON.parse(e.meta ?? "{}"); } catch {}
      const key = m.uat ? keyOf.get(m.uat) : undefined;
      if (!key || recent.some((r) => r.nr === e.target && r.uat === m.uat)) continue;
      recent.push({ nr: e.target, uat: m.uat!, key, area: typeof m.a === "number" ? m.a : null, at: e.at, href: `/localizare#${key}-${encodeURIComponent(e.target)}` });
      if (recent.length === 3) break;
    }
  }
  // Colaborări: a preview for those who activated it, the launch banner for those who may use it and have not yet
  const collab = c.modules.includes("colaborari");
  // "În curând: Colaborări" only for valuers without access while the module is not launched (never for non-valuers)
  const collabSoon = !collab && c.collab !== "on" && (c.super || !!c.user.anevar_no?.trim());
  const cs = collab ? await collabState(db, c.user).catch(() => null) : null;
  const launch = collab && cs && !cs.profile ? await collabLaunch(db, { id: c.user.id, county: c.user.county }).catch(() => null) : null;
  const asked = new Set((await db.prepare("SELECT DISTINCT target FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify'").bind(c.user.id).all<{ target: string }>()).results.map((r) => r.target));

  return (
    <AppShell c={c} active="home" title={`Bună${first ? `, ${first}` : ""}!`} subtitle={sub}>
      {c.block && !c.super && <div className="note">{c.block} Scrie-ne la <a className="rowLink" href="mailto:office@uvalo.ro">office@uvalo.ro</a> ca să reactivăm accesul.</div>}

      <div className="home">
        {launch && <CollabLaunch l={launch} />}
        <section className="homeHero" aria-label="Localizator cadastral">
          <div className="heroHead">
            <h2>Localizator cadastral</h2>
            {parcels > 0 && <span className="heroMeta">{counties.length === 1 ? `jud. ${counties[0]}` : `${counties.length} județe`} · {parcels.toLocaleString("ro-RO")} imobile · {list.length} UAT</span>}
            {loc && <a className="heroOpen" href="/localizare">Deschide harta →</a>}
          </div>
          {loc ? (
            <QuickSearch uats={list.map((u) => ({ key: u.key, name: u.name, county: u.county ?? "Timiș" }))} amp={amp} dark />
          ) : (
            <p className="heroNote">{c.off.includes("localizare") ? "Localizatorul cadastral este dezactivat temporar. Revine în curând." : "Abonamentul firmei tale nu include localizatorul cadastral."}</p>
          )}
        </section>

        {cs?.profile && <CollabHome s={cs} />}
        <div className="homeRow">
          {loc && (
            <section className="recentBox" aria-labelledby="recentT">
              <h2 id="recentT" className="boxHead">Ultimele imobile căutate</h2>
              {recent.length ? (
                <ul className="recent">
                  {recent.map((r) => (
                    <li key={r.href}>
                      <a className="recentMain" href={r.href}>
                        <span className="recentPin" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" fill="currentColor" /></svg></span>
                        <span className="recentText">
                          <b>{r.nr}</b>
                          <span className="recentMeta">{[r.uat, r.area != null ? `${r.area.toLocaleString("ro-RO")} mp` : null, when(r.at)].filter(Boolean).join(" · ")}</span>
                        </span>
                      </a>
                      {amp && <a className="recentAct" href={`/amplasament?uat=${encodeURIComponent(r.key)}&nr=${encodeURIComponent(r.nr)}`}>Amplasament</a>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="recentEmpty">Imobilele pe care le deschizi în localizator apar aici, ca să revii la ele dintr-un click.</p>
              )}
            </section>
          )}

          <section className="toolsCol" aria-labelledby="toolsT">
            <h2 id="toolsT" className="homeSec">Instrumente</h2>
            {TOOLS.map(({ key, href, name, desc, Thumb }) => {
              const on = c.modules.includes(key);
              const body = (
                <>
                  <Thumb />
                  <span className="toolText"><b>{name}</b><span>{on ? desc : c.off.includes(key) ? "Dezactivat temporar" : "Nu e inclus în abonament"}</span></span>
                  {on && <span className="toolGo" aria-hidden="true">→</span>}
                </>
              );
              return on ? <a key={key} className="toolTile" href={href}>{body}</a> : <div key={key} className="toolTile off">{body}</div>;
            })}
          </section>
        </div>

        <section aria-labelledby="soonT">
          <h2 id="soonT" className="homeSec">În curând în UVALO</h2>
          <div className="soonGrid">
            {SOON.filter((x) => x.key !== "colaborari" || collabSoon).map(({ key, Art, name, desc }) => (
              <div key={key} className="soonBig">
                <Art />
                <div className="soonBody">
                  <span className="soonTag">Lansare în curând</span>
                  <h3>{name}</h3>
                  <p>{desc}</p>
                  <NotifyButton k={key} done={asked.has(key)} label="Anunță-mă la lansare" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mobileOnly" style={{ marginTop: 16 }}><Referral variant="card" /></div>
    </AppShell>
  );
}
