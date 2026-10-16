// The new home page (dashboard, canvas „UVALO — Dashboard Acasă”): search, today's numbers, the inspections on a map / calendar,
// the phone, what needs attention, Colaborări, the tools carousel, the month, recent documents, recent activity.
// Shown by its mode (Admin → Instrumente → Acasă nouă, c.homeNew); the old home stays for everyone else.
import type { Ctx } from "@/lib/access";
import { firstName } from "@/lib/guard";
import { uats } from "@/lib/cadastre";
import { collabState, relevantCount } from "@/lib/collab";
import { canPrepare, devices, inspUrl, isOps, listInspections, phoneNotifs } from "@/lib/insp";
import { AppShell } from "./AppShell";
import { QuickSearch } from "./QuickSearch";
import { NotifyButton } from "./NotifyButton";
import { InspPreview } from "./InspPreview";
import { InspBell } from "./InspBell";
import { HdInsp, type HdRow } from "./HdInsp";
import { HdTools, type HdTool } from "./HdTools";

const TZ = "Europe/Bucharest";
const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const nf = (n: number) => n.toLocaleString("ro-RO");
function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "chiar acum";
  if (m < 60) return `acum ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "acum o oră" : `acum ${h} ore`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : d < 7 ? `acum ${d} zile` : new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", timeZone: TZ });
}
const initials = (s: string | null | undefined) => (s ?? "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const short = (a: string) => a.split(",").slice(0, 2).join(",").trim();
const plural = (n: number, one: string, many: string) => (n === 1 ? `o ${one}` : `${n} ${many}`);

type Db = D1Database;

export async function HomeDash({ db, c }: { db: Db; c: Ctx }) {
  const has = (m: string) => c.modules.includes(m);
  const loc = has("localizare"), amp = has("amplasament"), insp = has("inspectii"), collab = has("colaborari");
  const uid = c.user.id;
  const now = new Date();
  const today = dayOf(now);
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }));
  const first = await firstName(db, c.user.name, c.user.anevar_no);
  const hello = `${hour < 11 ? "Bună dimineața" : hour < 18 ? "Bună ziua" : "Bună seara"}${first ? `, ${first}` : ""}`;
  const day = now.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const sub = [day.charAt(0).toUpperCase() + day.slice(1), c.user.county].filter(Boolean).join(" · ");
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;

  // the week (Monday to Sunday, Romanian time)
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const mon = new Date(`${today}T12:00:00Z`); mon.setUTCDate(mon.getUTCDate() - wd);
  const sun = new Date(mon); sun.setUTCDate(sun.getUTCDate() + 6);
  const [w0, w1] = [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];

  const [list, rowsAll, devs, notifs, cs, zoneN, push, recentEv, aiN, toolUse, asked] = await Promise.all([
    loc ? uats(new Request("https://uvalo.local/")).catch(() => []) : Promise.resolve([]),
    insp ? listInspections(db, c).catch(() => []) : Promise.resolve([]),
    insp ? devices(db, uid).catch(() => []) : Promise.resolve([]),
    insp ? phoneNotifs(db, uid).catch(() => []) : Promise.resolve([]),
    collab ? collabState(db, c.user).catch(() => null) : Promise.resolve(null),
    collab ? relevantCount(db, uid).catch(() => 0) : Promise.resolve(0),
    insp ? db.prepare("SELECT COUNT(*) AS n FROM insp_push WHERE user_id = ?").bind(uid).first<{ n: number }>().catch(() => null) : Promise.resolve(null),
    loc ? db.prepare("SELECT target, meta, at FROM events WHERE user_id = ? AND module = 'localizare' AND action = 'parcel' AND target IS NOT NULL ORDER BY id DESC LIMIT 60")
      .bind(uid).all<{ target: string; meta: string | null; at: string }>().then((r) => r.results).catch(() => []) : Promise.resolve([]),
    db.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = ? AND at >= ? AND ((module = 'amplasament' AND action IN ('ai', 'ai_plan')) OR (module = 'inspectii' AND action = 'ai_rlv'))")
      .bind(uid, monthStart).first<{ n: number }>().catch(() => null),
    db.prepare("SELECT module, COUNT(*) AS n FROM events WHERE user_id = ? AND module IN ('word', 'chrome', 'comparabile') GROUP BY module").bind(uid)
      .all<{ module: string; n: number }>().then((r) => new Map(r.results.map((x) => [x.module, x.n]))).catch(() => new Map<string, number>()),
    db.prepare("SELECT 1 FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify' AND target = 'analize' LIMIT 1").bind(uid).first().catch(() => null),
  ]);

  // the locator's recent parcels (for the "Recente" chips and the documents' fallback)
  const keyOf = new Map(list.map((u) => [u.name, u.key]));
  const recent: { nr: string; uat: string; key: string; area: number | null; at: string; href: string }[] = [];
  for (const e of recentEv) {
    let m: { uat?: string; a?: number | null } = {};
    try { m = JSON.parse(e.meta ?? "{}"); } catch {}
    const key = m.uat ? keyOf.get(m.uat) : undefined;
    if (!key || recent.some((r) => r.nr === e.target && r.uat === m.uat)) continue;
    recent.push({ nr: e.target, uat: m.uat!, key, area: typeof m.a === "number" ? m.a : null, at: e.at, href: `/localizare#${key}-${encodeURIComponent(e.target)}` });
    if (recent.length === 4) break;
  }
  const parcels = list.reduce((s, u) => s + u.n, 0);

  /* ---------- inspections ---------- */
  const ops = isOps(c);
  const rows = rowsAll.filter((r) => !r.test || c.insp !== "on");
  const mineToDo = (r: (typeof rows)[number]) => r.assignee_id === uid || (r.who !== "forothers" && canPrepare(c, r));
  const open = rows.filter((r) => ["prog", "plan", "lucru"].includes(r.status));
  const todayRows = open.filter((r) => r.scheduled_at?.startsWith(today) && r.status !== "prog");
  const weekRows = rows.filter((r) => r.scheduled_at && r.scheduled_at.slice(0, 10) >= w0 && r.scheduled_at.slice(0, 10) <= w1);
  const unplanned = open.filter((r) => r.status === "prog" && !r.scheduled_at);
  const verify = rows.filter((r) => r.status === "gata" && r.who !== "forothers" && canPrepare(c, r))
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
  const pending = rows.filter((r) => r.assign_state === "pending" && canPrepare(c, r));
  const declined = rows.filter((r) => r.assign_state === "declined" && canPrepare(c, r));
  const redo = rows.filter((r) => r.assignee_id === uid && r.status === "lucru" && r.redo_note);
  const onSite = todayRows.filter((r) => r.status === "lucru").length;
  // the map / calendar: what is open, plus what was finished in the last 14 days
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const mapRows: HdRow[] = rows.filter((r) => mineToDo(r) && (open.includes(r) || (r.finished_at ?? "") > since)).slice(0, 120);
  const nextRows = [...open.filter((r) => r.scheduled_at && r.scheduled_at.slice(0, 10) >= today)].sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
  const lastDone = rows.filter((r) => r.status === "gata" || r.status === "pred").sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
  const listRows: HdRow[] = [...nextRows.slice(0, 3), ...lastDone.slice(0, Math.max(1, 4 - Math.min(3, nextRows.length)))].slice(0, 4);

  // the month: inspections finished by me, average time, photos, AI readings; inspections per week (last 8 weeks)
  const [st, ph, weeks, docs] = insp ? await Promise.all([
    db.prepare(`SELECT SUM(CASE WHEN substr(finished_at, 1, 7) = ?2 THEN 1 ELSE 0 END) AS month,
      SUM(CASE WHEN substr(finished_at, 1, 7) = ?3 THEN 1 ELSE 0 END) AS prev,
      AVG(CASE WHEN substr(finished_at, 1, 7) = ?2 AND started_at IS NOT NULL THEN (julianday(finished_at) - julianday(started_at)) * 1440 END) AS avg_min
      FROM inspections WHERE assignee_id = ?1 AND finished_at IS NOT NULL AND deleted_at IS NULL`)
      .bind(uid, month, prevMonth(month)).first<{ month: number | null; prev: number | null; avg_min: number | null }>().catch(() => null),
    db.prepare("SELECT COUNT(*) AS n FROM insp_files f JOIN inspections i ON i.id = f.inspection_id WHERE i.assignee_id = ? AND f.kind = 'photo' AND f.created_at >= ?")
      .bind(uid, monthStart).first<{ n: number }>().catch(() => null),
    db.prepare("SELECT finished_at FROM inspections WHERE assignee_id = ? AND finished_at > ? AND deleted_at IS NULL").bind(uid, new Date(Date.now() - 56 * 864e5).toISOString())
      .all<{ finished_at: string }>().then((r) => r.results).catch(() => []),
    db.prepare(`SELECT f.id, f.kind, f.name, f.created_at, i.id AS insp, i.address, i.cad_nr FROM insp_files f JOIN inspections i ON i.id = f.inspection_id
      WHERE f.kind IN ('cf', 'releveu', 'doc') AND i.deleted_at IS NULL AND (i.created_by = ?1 OR i.assignee_id = ?1) ORDER BY f.created_at DESC LIMIT 4`)
      .bind(uid).all<{ id: string; kind: string; name: string | null; created_at: string; insp: string; address: string; cad_nr: string | null }>().then((r) => r.results).catch(() => []),
  ]) : [null, null, [] as { finished_at: string }[], [] as never[]];
  const spark = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - (7 - i) * 7 * 864e5, start = end - 7 * 864e5;
    return weeks.filter((w) => { const t = new Date(w.finished_at).getTime(); return t > start && t <= end; }).length;
  });
  const monthName = now.toLocaleDateString("ro-RO", { month: "long", timeZone: TZ });

  /* ---------- Colaborări ---------- */
  const zone = cs?.profile ? cs.feed.filter((p) => p.inZone && !p.own).sort((a, b) => b.created_at.localeCompare(a.created_at)) : [];
  const myPost = cs?.mine.find((p) => p.status === "active" || p.status === "inlucru");
  const unread = cs ? cs.convs.reduce((s, x) => s + (x.unread || 0), 0) : 0;

  /* ---------- what needs attention ---------- */
  const todo: { ico: string; tone: string; title: string; sub: string; href: string }[] = [];
  for (const r of redo.slice(0, 1)) todo.push({ ico: "!", tone: "red", title: "Fișă întoarsă pentru completări", sub: `${short(r.address)} · ${r.redo_note}`, href: `/inspectii/${r.id}` });
  for (const r of verify.slice(0, 2)) todo.push({ ico: "✓", tone: "green", title: `Verifică fișa${r.sheet_no ? ` ${r.sheet_no}` : ""}`, sub: `${short(r.address)} · finalizată ${r.finished_at ? ago(r.finished_at) : ""}${r.assignee_id && r.assignee_id !== uid && r.assignee_name ? ` de ${r.assignee_name.split(" ")[0]}` : ""}`, href: `/inspectii/${r.id}` });
  for (const r of pending.slice(0, 1)) todo.push({ ico: "?", tone: "violet", title: `${r.assignee_name ?? "Colaboratorul"} n-a răspuns`, sub: `Solicitare · ${short(r.address)}`, href: `/inspectii/${r.id}` });
  for (const r of declined.slice(0, 1)) todo.push({ ico: "×", tone: "red", title: "Solicitare refuzată · alege altcineva", sub: short(r.address), href: `/inspectii/${r.id}` });
  if (unplanned.length) todo.push({ ico: "+", tone: "gold", title: `${plural(unplanned.length, "inspecție", "inspecții")} fără dată`, sub: unplanned.slice(0, 2).map((r) => short(r.address).split(",")[0]).join(" · "), href: "/inspectii" });
  if (myPost && myPost.requests.some((q) => !q.conv_id)) {
    const n = myPost.requests.filter((q) => !q.conv_id).length;
    todo.push({ ico: "→", tone: "violet", title: `${plural(n, "cerere nouă", "cereri noi")} la anunțul tău`, sub: `${myPost.title || myPost.prop} · ${myPost.city}`, href: "/colaborari?view=mine" });
  }
  if (unread) todo.push({ ico: "✉", tone: "violet", title: `${plural(unread, "mesaj necitit", "mesaje necitite")}`, sub: "Colaborări", href: "/colaborari?view=chat" });

  /* ---------- activity ---------- */
  const feed = [
    ...notifs.slice(0, 6).map((n) => ({ at: n.at, who: n.who ?? "Cineva", text: `${n.text.charAt(0).toLowerCase()}${n.text.slice(1)} · ${short(n.address).split(",")[0]}`, href: `/inspectii/${n.insp}`, tone: "gold" })),
    ...(cs?.notifs ?? []).slice(0, 6).map((n) => ({ at: n.created_at, who: "", text: n.text, href: "/colaborari", tone: "violet" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  /* ---------- tools (carousel) ---------- */
  const tools: HdTool[] = [];
  if (loc) tools.push({ key: "localizare", href: "/localizare", name: "Localizator cadastral", desc: "Parcele ANCPI, export PDF / Word", tag: list.length ? `${list.length} UAT` : undefined });
  if (amp) tools.push({ key: "amplasament", href: "/amplasament", name: "Analiză amplasament", desc: "Zona, dotări, descriere", tag: "AI" });
  if (has("comparabile")) tools.push({ key: "comparabile", href: "/comparabile", name: "Comparabile", desc: "Hartă și tabel pentru raport" });
  if (has("word")) tools.push({ key: "word", href: "/word", name: "UVALO pentru Word", desc: "Add-in: anexe foto și acte", tag: toolUse.get("word") ? "folosit" : undefined });
  if (has("chrome")) tools.push({ key: "chrome", href: "/chrome", name: "UVALO pentru Chrome", desc: "Extensie: capturi de anunțuri", tag: toolUse.get("chrome") ? "folosit" : undefined });
  if (amp) tools.push({ key: "cf", href: "/amplasament", name: "CF / plan citit cu AI", desc: "Nr. cadastral, suprafețe, Stereo 70", dark: true });
  tools.push({ key: "analize", href: null, name: "Analize de piață", desc: "În curând" });

  const dev = devs[0];
  const kpis = [
    insp && { ico: "AZI", tone: "gold", n: todayRows.length, label: `${todayRows.length === 1 ? "inspecție" : "inspecții"} azi${onSite ? ` · ${onSite} pe teren acum` : ""}`, href: "/inspectii" },
    insp && { ico: `S${isoWeek(now)}`, tone: "ink", n: weekRows.length, label: "inspecții săptămâna aceasta", href: "/inspectii" },
    insp && { ico: "✓", tone: "green", n: verify.length, label: verify.length === 1 ? "fișă de verificat" : "fișe de verificat", href: verify[0] ? `/inspectii/${verify[0].id}` : "/inspectii" },
    collab && cs?.profile && { ico: "NOU", tone: "violet", n: zoneN, label: zoneN === 1 ? "lucrare nouă în zonă" : "lucrări noi în zonă", href: "/colaborari" },
    !insp && loc && { ico: "UAT", tone: "ink", n: list.length, label: `localități cu plan · ${nf(parcels)} imobile`, href: "/localizare" },
    !insp && aiN && { ico: "AI", tone: "gold", n: aiN.n, label: `analize AI în ${monthName}`, href: "/amplasament" },
  ].filter(Boolean) as { ico: string; tone: string; n: number; label: string; href: string }[];

  const lead = [
    insp && todayRows.length ? <b key="i">{plural(todayRows.length, "inspecție azi", "inspecții azi")}</b> : null,
    collab && zoneN ? <b key="c" className="hdGold">{plural(zoneN, "lucrare nouă", "lucrări noi")}</b> : null,
  ].filter(Boolean);

  return (
    <AppShell c={c} active="home" title={hello} subtitle={sub}
      actions={insp ? <>{notifs.length > 0 && <InspBell items={notifs} />}<InspPreview appUrl={inspUrl()} /></> : undefined}>
      {c.block && !c.super && <div className="note">{c.block} Scrie-ne la <a className="rowLink" href="mailto:office@uvalo.ro">office@uvalo.ro</a> ca să reactivăm accesul.</div>}
      <div className="hd">
        <section className="hdHero" aria-label="Căutare">
          <svg className="hdHeroArt" viewBox="0 0 400 200" aria-hidden="true"><g fill="none" stroke="#E0AD4F" strokeOpacity=".14" strokeWidth="1.2"><path d="M40 180 L120 60 L230 90 L300 20 L390 70" /><path d="M0 120 L90 140 L170 110 L260 160 L400 130" /><path d="M120 60 L170 110 M230 90 L260 160 M300 20 L330 120 L400 130" /><path d="M90 140 L40 180 M330 120 L260 160" /></g></svg>
          <div className="hdHeroHead">
            <p className="hdLead">
              {lead.length ? <>Ai {lead.length === 2 ? <>{lead[0]} și {lead[1]} de la colegi în zona ta</> : <>{lead[0]}{collab && zoneN ? " de la colegi în zona ta" : ""}</>}.</>
                : <>Caută un imobil după nr. cadastral, adresă, coordonate sau încarcă un extras CF.</>}
            </p>
            {parcels > 0 && <span className="hdMeta">Localizator · {list.length} UAT · {nf(parcels)} imobile</span>}
          </div>
          {loc ? (
            <QuickSearch uats={list.map((u) => ({ key: u.key, name: u.name, county: u.county ?? "Timiș" }))} amp={amp} dark
              extra={insp ? <a className="quickBtn alt" href="/inspectii/nou">+ Inspecție</a> : undefined}
              recent={recent.map((r) => ({ label: `${r.nr} · ${r.uat}`, href: r.href }))} />
          ) : (
            <p className="heroNote">{c.off.includes("localizare") ? "Localizatorul cadastral este dezactivat temporar. Revine în curând." : "Abonamentul firmei tale nu include localizatorul cadastral."}</p>
          )}
        </section>

        {kpis.length > 0 && (
          <div className="hdKpis">
            {kpis.map((k) => (
              <a key={k.label} className="hdKpi" href={k.href}>
                <span className={`hdKpiIco t-${k.tone}`}>{k.ico}</span>
                <span><b>{nf(k.n)}</b><small>{k.label}</small></span>
              </a>
            ))}
          </div>
        )}

        <div className="hdMain">
          {insp ? (
            <section className="hdCard hdInsp" aria-labelledby="hdInspT">
              <HdInsp rows={mapRows} list={listRows} meId={uid}
                title={<span className="hdTitle"><h2 id="hdInspT">Inspecții</h2><small>Azi {todayRows.length} · săptămâna aceasta {weekRows.length} · de programat {unplanned.length}</small></span>} />
            </section>
          ) : (
            <section className="hdCard hdPad" aria-labelledby="hdRecT">
              <div className="hdHead"><h2 id="hdRecT">Ultimele imobile căutate</h2>{loc && <a href="/localizare">Harta →</a>}</div>
              {recent.length ? recent.map((r) => (
                <div key={r.href} className="hdRow">
                  <a className="hdRowMain" href={r.href}><span className="hdDoc t-gold">NR</span><span><b>{r.nr}</b><small>{[r.uat, r.area != null ? `${nf(r.area)} mp` : null, ago(r.at)].filter(Boolean).join(" · ")}</small></span></a>
                  {amp && <a className="hdChipBtn" href={`/amplasament?uat=${encodeURIComponent(r.key)}&nr=${encodeURIComponent(r.nr)}`}>Amplasament</a>}
                </div>
              )) : <p className="hdEmpty">Imobilele pe care le deschizi în localizator apar aici, ca să revii la ele dintr-un click.</p>}
            </section>
          )}

          <div className="hdSide">
            {insp && !ops && (
              <section className="hdPhone" aria-label="Telefonul">
                <span className="hdPhoneArt" aria-hidden="true"><i /><b /><b /><b /><b /></span>
                <span className="hdPhoneText">
                  {dev ? <>
                    <span className="hdPhoneOn"><i />{dev.platform === "test" ? "Mod test (fără telefon)" : `${dev.name || "Telefon"} conectat`}</span>
                    <small>{dev.last_seen_at ? `Ultimul semnal ${ago(dev.last_seen_at)}` : `Conectat ${ago(dev.created_at)}`}</small>
                    <small>{push?.n ? "Notificări push active" : "Notificările push sunt oprite"}</small>
                  </> : <>
                    <span className="hdPhoneOn off"><i />Niciun telefon conectat</span>
                    <small>Inspecțiile se fac din aplicația de telefon.</small>
                  </>}
                  <a href="/inspectii">{dev ? "Inspecțiile tale →" : "Conectează telefonul →"}</a>
                </span>
              </section>
            )}

            <section className="hdCard hdPad" aria-labelledby="hdTodoT">
              <h2 id="hdTodoT" className="hdH">Necesită atenția ta</h2>
              {todo.length ? todo.slice(0, 4).map((t) => (
                <a key={t.title + t.href} className="hdTodo" href={t.href}>
                  <span className={`hdTodoIco t-${t.tone}`}>{t.ico}</span>
                  <span><b>{t.title}</b><small>{t.sub}</small></span>
                  <span className="hdGo" aria-hidden="true">›</span>
                </a>
              )) : <p className="hdEmpty">Nimic urgent. Totul e la zi.</p>}
            </section>

            {collab && (
              <section className="hdCollab" aria-labelledby="hdColT">
                <div className="hdHead"><small id="hdColT">COLABORĂRI{zoneN ? ` · ${zoneN} ${zoneN === 1 ? "NOUĂ" : "NOI"}` : ""}</small><a href="/colaborari">Toate →</a></div>
                {!cs?.profile ? (
                  <p className="hdEmpty">Lucrări ocazionale între evaluatori: inspecții și rapoarte în zona ta. <a href="/colaborari">Activează profilul →</a></p>
                ) : zone.length ? zone.slice(0, 2).map((p) => (
                  <a key={p.id} className="hdPost" href={`/colaborari?post=${p.id}`}>
                    <span className="hdPostTop"><b>{p.title || `${p.prop} · ${p.city}`}</b>{p.dist != null && <small>{p.dist < 4 ? "în localitate" : `${Math.round(p.dist)} km`}</small>}</span>
                    <small>{p.kind === "inspectie" ? "Inspecție" : "Raport + inspecție"}{p.due ? ` · termen ${new Date(`${p.due}T12:00:00Z`).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}` : ""} · {p.budget == null ? "de stabilit" : `${nf(p.budget)} lei`}</small>
                    <span className="hdPostBy"><span className="hdAv">{p.author.init}</span><small>{p.author.name}</small><span className="hdPostGo">Vreau detalii</span></span>
                  </a>
                )) : <p className="hdEmpty">Niciun anunț nou în zonele tale.</p>}
                {myPost && <small className="hdPostMine">Anunțul tău din {myPost.city}: <b>{plural(myPost.requests.length, "cerere", "cereri")}</b>{unread ? ` · ${plural(unread, "mesaj necitit", "mesaje necitite")}` : ""}</small>}
              </section>
            )}
          </div>
        </div>

        <HdTools tools={tools} />

        <div className="hdBottom">
          {insp && (
            <section className="hdCard hdPad" aria-labelledby="hdMonT">
              <div className="hdHead"><h2 id="hdMonT">Luna ta · {monthName}</h2><a href="/inspectii">Inspecții →</a></div>
              <div className="hdStats">
                <span><small>INSPECȚII</small><b>{st?.month ?? 0}</b>{st?.prev != null && (st.month ?? 0) !== st.prev && <small className={(st.month ?? 0) > st.prev ? "up" : "down"}>{(st.month ?? 0) > st.prev ? "▲" : "▼"} {Math.abs((st.month ?? 0) - st.prev)}</small>}</span>
                <span><small>TIMP MEDIU</small><b>{st?.avg_min ? Math.round(st.avg_min) : "—"}</b>{!!st?.avg_min && <small>min</small>}</span>
                <span><small>FOTOGRAFII</small><b>{nf(ph?.n ?? 0)}</b></span>
                <span><small>ANALIZE AI</small><b>{aiN?.n ?? 0}</b></span>
              </div>
              <Spark data={spark} />
              <small className="hdMuted">Inspecții finalizate pe săptămână · ultimele 8</small>
            </section>
          )}

          <section className="hdCard hdPad" aria-labelledby="hdDocT">
            <div className="hdHead"><h2 id="hdDocT">{docs.length ? "Documente recente" : "Ultimele imobile căutate"}</h2>{docs.length ? <a href="/inspectii">Toate →</a> : loc ? <a href="/localizare">Harta →</a> : null}</div>
            {docs.length ? docs.map((d) => (
              <a key={d.id} className="hdRowMain hdDocRow" href={`/inspectii/${d.insp}`}>
                <span className={`hdDoc ${d.kind === "cf" ? "t-gold" : d.kind === "releveu" ? "t-blue" : "t-ink"}`}>{d.kind === "cf" ? "CF" : d.kind === "releveu" ? "RLV" : "DOC"}</span>
                <span><b>{d.kind === "cf" ? "Extras CF" : d.kind === "releveu" ? "Releveu" : d.name || "Document"}{d.cad_nr ? ` ${d.cad_nr}` : ""}</b><small>{short(d.address)}</small></span>
                <small className="hdWhen">{ago(d.created_at)}</small>
              </a>
            )) : recent.length ? recent.map((r) => (
              <a key={r.href} className="hdRowMain hdDocRow" href={r.href}>
                <span className="hdDoc t-gold">NR</span>
                <span><b>{r.nr}</b><small>{[r.uat, r.area != null ? `${nf(r.area)} mp` : null].filter(Boolean).join(" · ")}</small></span>
                <small className="hdWhen">{ago(r.at)}</small>
              </a>
            )) : <p className="hdEmpty">Actele atașate la inspecții și imobilele căutate apar aici.</p>}
          </section>

          <section className="hdCard hdPad" aria-labelledby="hdActT">
            <h2 id="hdActT" className="hdH">Activitate recentă</h2>
            {feed.length ? feed.map((f, i) => (
              <a key={i} className="hdAct" href={f.href}>
                <span className={`hdAv t-${f.tone}`}>{f.who ? initials(f.who) : "C"}</span>
                <span><span>{f.who && <b>{f.who} </b>}{f.text}</span><small>{ago(f.at)}</small></span>
              </a>
            )) : <p className="hdEmpty">Ce fac colegii pe inspecțiile tale și noutățile din Colaborări apar aici.</p>}
          </section>
        </div>

        <section className="hdSoon" aria-label="În curând">
          <span className="hdSoonTag">ÎN CURÂND</span>
          <span className="hdSoonText"><b>Analize de piață pe zona ta</b><small>Prețuri și chirii din tranzacții și anunțuri, pe localitate și tip de imobil, gata de pus în raport.</small></span>
          <NotifyButton k="analize" done={!!asked} label="Anunță-mă la lansare" />
        </section>
      </div>
    </AppShell>
  );
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data), w = 300, h = 54;
  const pts = data.map((v, i) => [Math.round((i / (data.length - 1)) * w), Math.round(h - 6 - (v / max) * (h - 14))]);
  const line = pts.map((p) => p.join(",")).join(" ");
  return (
    <svg className="hdSpark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Inspecții pe săptămână: ${data.join(", ")}`}>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="#E0AD4F" fillOpacity=".16" />
      <polyline points={line} fill="none" stroke="#E0AD4F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => i === pts.length - 1 && <circle key={i} cx={x} cy={y} r="4" fill="#141414" stroke="#E0AD4F" strokeWidth="2" />)}
    </svg>
  );
}
