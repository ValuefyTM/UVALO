// The new home page (dashboard, canvas „UVALO — Acasă: două propuneri noi”, variant B „Panoul de lucru”): the dark band with the
// greeting, the phone, the bell and the avatar, then the search bar; under it the focus on Inspecții (map + the next ones) and
// Colaborări side by side, a compact row (what needs attention, the month, recent activity) and a thin band of tools.
// Every card has a light placemark with its own action when it is empty.
// Shown by its mode (Admin → Instrumente → Acasă nouă, c.homeNew); the old home stays for everyone else.
import type { Ctx } from "@/lib/access";
import { firstName, initials as initialsOf } from "@/lib/guard";
import { uats } from "@/lib/cadastre";
import { activatedCount, collabState, relevantCount } from "@/lib/collab";
import { canPrepare, devices, inspUrl, isOps, listInspections, phoneNotifs } from "@/lib/insp";
import { supportUnread } from "@/lib/support";
import { AppShell } from "./AppShell";
import { QuickSearch } from "./QuickSearch";
import { InspBell } from "./InspBell";
import { HdInsp, type HdRow } from "./HdInsp";
import { HdPhone } from "./HdPhone";
import { ViewAsButton } from "./ViewAs";
import { nr } from "@/lib/plural";

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
/** "16:47" today, "ieri", otherwise "ma 3" (the activity's time column) */
function stamp(iso: string) {
  const d = new Date(iso), today = dayOf(new Date());
  if (dayOf(d) === today) return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  if (dayOf(d) === dayOf(new Date(Date.now() - 864e5))) return "ieri";
  return d.toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", timeZone: TZ }).replace(".", "");
}
const short = (a: string) => a.split(",").slice(0, 2).join(",").trim();
const plural = (n: number, one: string, many: string) => (n === 1 ? `o ${one}` : nr(n, one, many));
const Plus = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

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
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;

  // the week (Monday to Sunday, Romanian time)
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const mon = new Date(`${today}T12:00:00Z`); mon.setUTCDate(mon.getUTCDate() - wd);
  const sun = new Date(mon); sun.setUTCDate(sun.getUTCDate() + 6);
  const [w0, w1] = [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];

  const [list, rowsAll, devs, notifs, cs, zoneN, push, recentEv, aiN, toolUse, supN, colleagues] = await Promise.all([
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
    db.prepare("SELECT module, COUNT(*) AS n FROM events WHERE user_id = ? AND module IN ('word', 'chrome', 'comparabile', 'localizare') GROUP BY module").bind(uid)
      .all<{ module: string; n: number }>().then((r) => new Map(r.results.map((x) => [x.module, x.n]))).catch(() => new Map<string, number>()),
    supportUnread(db, uid).catch(() => 0),
    collab ? activatedCount(db).catch(() => 20) : Promise.resolve(0),
  ]);

  // the locator's recent parcels (the "Recente" chips under the search bar; the card for those without Inspecții)
  const keyOf = new Map(list.map((u) => [u.name, u.key]));
  const recent: { nr: string; uat: string; key: string; area: number | null; at: string; href: string }[] = [];
  for (const e of recentEv) {
    let m: { uat?: string; a?: number | null } = {};
    try { m = JSON.parse(e.meta ?? "{}"); } catch {}
    const key = m.uat ? keyOf.get(m.uat) : undefined;
    if (!key || recent.some((r) => r.nr === e.target && r.uat === m.uat)) continue;
    recent.push({ nr: e.target, uat: m.uat!, key, area: typeof m.a === "number" ? m.a : null, at: e.at, href: `/localizare#${key}-${encodeURIComponent(e.target)}` });
    if (recent.length === 5) break;
  }

  /* ---------- inspections ---------- */
  const ops = isOps(c);
  const rows = rowsAll.filter((r) => !r.test); // the inspections made while the module was in test stay out of the home page
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
  // the map / calendar / list: only what is not finished (În lucru, Programată, De programat)
  const mapRows: HdRow[] = rows.filter((r) => mineToDo(r) && open.includes(r)).slice(0, 120);
  const rank = (r: (typeof rows)[number]) => (r.status === "lucru" ? 0 : r.status === "plan" ? 1 : 2);
  const listRows: HdRow[] = [...mapRows].sort((a, b) => rank(a) - rank(b) || (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999")).slice(0, 6);

  // the month: inspections finished by me, average time, photos; inspections per week (last 8 weeks)
  const [st, ph, weeks] = insp ? await Promise.all([
    db.prepare(`SELECT SUM(CASE WHEN substr(finished_at, 1, 7) = ?2 THEN 1 ELSE 0 END) AS month,
      AVG(CASE WHEN substr(finished_at, 1, 7) = ?2 AND started_at IS NOT NULL THEN (julianday(finished_at) - julianday(started_at)) * 1440 END) AS avg_min
      FROM inspections WHERE assignee_id = ?1 AND finished_at IS NOT NULL AND deleted_at IS NULL`)
      .bind(uid, month).first<{ month: number | null; avg_min: number | null }>().catch(() => null),
    db.prepare("SELECT COUNT(*) AS n FROM insp_files f JOIN inspections i ON i.id = f.inspection_id WHERE i.assignee_id = ? AND f.kind = 'photo' AND f.created_at >= ?")
      .bind(uid, monthStart).first<{ n: number }>().catch(() => null),
    db.prepare("SELECT finished_at FROM inspections WHERE assignee_id = ? AND finished_at > ? AND deleted_at IS NULL").bind(uid, new Date(Date.now() - 56 * 864e5).toISOString())
      .all<{ finished_at: string }>().then((r) => r.results).catch(() => []),
  ]) : [null, null, [] as { finished_at: string }[]];
  const bars = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - (7 - i) * 7 * 864e5, start = end - 7 * 864e5;
    return weeks.filter((w) => { const t = new Date(w.finished_at).getTime(); return t > start && t <= end; }).length;
  });
  const monthName = now.toLocaleDateString("ro-RO", { month: "long", timeZone: TZ });
  const monthN = st?.month ?? 0;

  /* ---------- Colaborări ---------- */
  const zone = cs?.profile ? cs.feed.filter((p) => p.inZone && !p.own).sort((a, b) => b.created_at.localeCompare(a.created_at)) : [];
  const myPost = cs?.mine.find((p) => p.status === "active" || p.status === "inlucru");
  const unread = cs ? cs.convs.reduce((s, x) => s + (x.unread || 0), 0) : 0;
  const unreadConv = cs?.convs.find((x) => x.unread > 0) ?? null;

  /* ---------- what needs attention ---------- */
  const todo: { ico: string; tone: string; title: string; sub: string; href: string; act: string; dark?: boolean }[] = [];
  for (const r of redo.slice(0, 1)) todo.push({ ico: "!", tone: "red", title: "Fișă întoarsă pentru completări", sub: `${short(r.address)} · ${r.redo_note}`, href: `/inspectii/${r.id}`, act: "Deschide" });
  for (const r of declined.slice(0, 1)) todo.push({ ico: "×", tone: "red", title: "Solicitare refuzată · alege altcineva", sub: short(r.address), href: `/inspectii/${r.id}`, act: "Realocă", dark: true });
  for (const r of verify.slice(0, 2)) todo.push({ ico: "✓", tone: "green", title: `Verifică fișa${r.sheet_no ? ` ${r.sheet_no}` : ""}`, sub: `${short(r.address)} · finalizată ${r.finished_at ? ago(r.finished_at) : ""}${r.assignee_id && r.assignee_id !== uid && r.assignee_name ? ` de ${r.assignee_name.split(" ")[0]}` : ""}`, href: `/inspectii/${r.id}`, act: "Deschide" });
  for (const r of pending.slice(0, 1)) todo.push({ ico: "?", tone: "violet", title: `${r.assignee_name ?? "Colaboratorul"} n-a răspuns`, sub: `Solicitare · ${short(r.address)}`, href: `/inspectii/${r.id}`, act: "Vezi" });
  if (unplanned.length) todo.push({ ico: String(unplanned.length), tone: "gold", title: `${plural(unplanned.length, "inspecție", "inspecții")} fără dată`, sub: unplanned.slice(0, 2).map((r) => short(r.address).split(",")[0]).join(" · "), href: unplanned.length === 1 ? `/inspectii/nou?id=${unplanned[0].id}` : "/inspectii", act: "Programează" });
  if (myPost && myPost.requests.some((q) => !q.conv_id)) {
    const n = myPost.requests.filter((q) => !q.conv_id).length;
    todo.push({ ico: "→", tone: "violet", title: `${plural(n, "cerere nouă", "cereri noi")} la anunțul tău`, sub: `${myPost.title || myPost.prop} · ${myPost.city}`, href: "/colaborari?view=mine", act: "Vezi" });
  }
  if (unread) todo.push({ ico: "✉", tone: "violet", title: `${plural(unread, "mesaj necitit", "mesaje necitite")}`, sub: "Colaborări", href: "/colaborari?view=chat", act: "Citește" });
  if (supN) todo.push({ ico: "✓", tone: "green", title: `${plural(supN, "răspuns nou", "răspunsuri noi")} de la echipa UVALO`, sub: "Suport tehnic", href: "/suport", act: "Citește" });
  const toSolve = todo.length;

  /* ---------- activity ---------- */
  const feed = [
    ...notifs.slice(0, 8).map((n) => ({ at: n.at, who: n.who ?? "Cineva", text: `${n.text.charAt(0).toLowerCase()}${n.text.slice(1)} · ${short(n.address).split(",")[0]}`, href: `/inspectii/${n.insp}` })),
    ...(cs?.notifs ?? []).slice(0, 8).map((n) => ({ at: n.created_at, who: "", text: n.text, href: "/colaborari" })),
    ...recent.slice(0, 2).map((r) => ({ at: r.at, who: "", text: `Ai localizat ${r.nr} ${r.uat}`, href: r.href })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  // the phone app: a real phone (the test "device" without a phone does not count as installed)
  const realDev = devs.find((d) => d.platform !== "test") ?? null;
  const phone = insp && !ops ? (
    <HdPhone appUrl={inspUrl()} installed={!!realDev}
      title={realDev ? `${(realDev.name || "Telefon").replace(/\s*·\s*aplicație$/, "")} conectat` : ""}
      lines={realDev ? [realDev.last_seen_at ? `semnal ${ago(realDev.last_seen_at)}` : `conectat ${ago(realDev.created_at)}`, push?.n ? "push activ" : "push oprit"] : []} />
  ) : null;

  // the line under the greeting: the day, the county, today's inspections, what needs solving
  const sub = [
    day.charAt(0).toUpperCase() + day.slice(1), c.user.county,
    insp ? (todayRows.length ? `${plural(todayRows.length, "inspecție", "inspecții")} azi${onSite ? `, ${onSite === 1 ? "una în lucru acum" : `${onSite} în lucru acum`}` : ""}` : "nicio inspecție azi") : null,
    toSolve ? `${toSolve} de rezolvat` : "nimic de rezolvat",
  ].filter(Boolean).join(" · ");

  const inspTags = (
    <div className="hbTags">
      <span className={`hdTag t-gold${todayRows.length ? "" : " zero"}`}><b>{todayRows.length}</b>azi</span>
      {onSite > 0 && <span className="hdTag t-lucru"><b>{onSite}</b>pe teren acum</span>}
      <span className={`hdTag t-ink${weekRows.length ? "" : " zero"}`}><b>{weekRows.length}</b>săptămâna asta</span>
      <span className={`hdTag t-prog${unplanned.length ? "" : " zero"}`}><b>{unplanned.length}</b>de programat</span>
      {!ops && <a className="hbBtn dark sm" href="/inspectii/nou" style={{ marginLeft: "auto" }}><Plus />Inspecție nouă</a>}
    </div>
  );
  const inspEmpty = (
    <div className="hbEmpty soft">
      <b>Pregătește prima inspecție</b>
      <p>O pregătești pe web în două minute, o faci de pe telefon, fișa se completează singură.</p>
      <span className="hbActs">
        {!ops && <a className="hbBtn gold" href="/inspectii/nou"><Plus />Inspecție nouă</a>}
        {insp && !ops && <HdPhone appUrl={inspUrl()} installed={!!realDev} title="" lines={[]} variant="btn" />}
      </span>
    </div>
  );

  return (
    <AppShell c={c} active="home" title={hello} subtitle={sub} dark
      actions={<>
        {phone}
        {insp && <InspBell items={notifs} />}
        <a className="hbAv" href="/cont" title="Contul meu" aria-label="Contul meu">
          {c.user.has_avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`/api/avatar/${uid}`} alt="" />
            : initialsOf(c.user.name, c.user.email)}
        </a>
        {c.super && !c.viewAs && <ViewAsButton />}
      </>}
      hero={loc ? (
        <QuickSearch uats={list.map((u) => ({ key: u.key, name: u.name, county: u.county ?? "Timiș" }))} amp={amp} dark insp={insp && !ops}
          recent={recent.map((r) => ({ label: `${r.nr} · ${r.uat}`, href: r.href }))} />
      ) : (
        <p className="heroNote">{c.off.includes("localizare") ? "Localizatorul cadastral este dezactivat temporar. Revine în curând." : "Abonamentul firmei tale nu include localizatorul cadastral."}</p>
      )}>
      {c.block && !c.super && <div className="note">{c.block} Scrie-ne la <a className="rowLink" href="mailto:office@uvalo.ro">office@uvalo.ro</a> ca să reactivăm accesul.</div>}
      <div className="hb">
        <div className="hbGrid">
          {/* ---- left, 7/12: Inspecții (or the last parcels, without the module) ---- */}
          {insp ? (
            <section className="hbCard" aria-labelledby="hbInspT">
              <HdInsp rows={mapRows} list={listRows} meId={uid} title={<h2 id="hbInspT">Inspecții</h2>} tags={mapRows.length ? inspTags : null} empty={inspEmpty} />
            </section>
          ) : (
            <section className="hbCard" aria-labelledby="hbRecT">
              <div className="hbHead"><h2 id="hbRecT">Ultimele imobile căutate</h2>{loc && <a className="hbMore" href="/localizare">Harta →</a>}</div>
              {recent.length ? (
                <div className="hbRows">
                  {recent.map((r) => (
                    <a key={r.href} className="hbRow" href={r.href}>
                      <span className="hdNum" style={{ background: "#141414", color: "#E0AD4F" }}>NR</span>
                      <span className="hbRowTxt"><b>{r.nr}</b><small><span>{[r.uat, r.area != null ? `${nf(r.area)} mp` : null].filter(Boolean).join(" · ")}</span></small></span>
                      <span className="hbWhen"><small>{ago(r.at)}</small></span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="hbEmpty grow">
                  <i><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z" /><circle cx="12" cy="11" r="2.2" /></svg></i>
                  <b>Niciun imobil căutat încă</b><p>Imobilele pe care le deschizi în localizator apar aici, ca să revii la ele dintr-un click.</p>
                  {loc && <span className="hbActs"><a className="hbBtn line" href="/localizare">Deschide harta cadastrală</a></span>}
                </div>
              )}
            </section>
          )}

          {/* ---- right, 5/12: Colaborări (or what needs attention, without the module) ---- */}
          {collab ? (
            <section className="hbCard" aria-labelledby="hbColT">
              <div className="hbHead"><h2 id="hbColT">Colaborări <small>· în zonele tale</small></h2><a className="hbMore" href="/colaborari">{cs?.profile ? "Toate →" : "Deschide →"}</a></div>
              {!cs?.profile ? (
                <div className="hbEmpty grow">
                  <i><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" /><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.8c1.9.7 3 2.6 3 5.2" /></svg></i>
                  <b>Lucrări de la colegi, în zonele tale</b>
                  <p>Inspecții și rapoarte pe care colegii evaluatori le dau mai departe. Deschide Colaborările și spune-ne unde lucrezi.</p>
                  <span className="hbActs"><a className="hbBtn dark" href="/colaborari">Deschide Colaborările</a></span>
                  <small className="hbNote">{colleagues} colegi îl folosesc deja.</small>
                </div>
              ) : (
                <>
                  {unreadConv && (
                    <a className="hbMsg" href={`/colaborari?view=chat&conv=${unreadConv.id}`}>
                      <span className="hdNum" style={{ background: "#141414", color: "#E0AD4F" }}>{unreadConv.unread}</span>
                      <span className="hbRowTxt"><b>Mesaj nou de la {unreadConv.peer.name}</b>{unreadConv.last && <small><span>„{unreadConv.last.body.slice(0, 70)}{unreadConv.last.body.length > 70 ? "…" : ""}”</span></small>}</span>
                      <span className="hbBtn dark sm">Răspunde</span>
                    </a>
                  )}
                  {zone.length ? (
                    <div className="hbRows">
                      {zone.slice(0, unreadConv ? 3 : 4).map((p) => (
                        <a key={p.id} className="hbRow" href={`/colaborari?post=${p.id}`}>
                          <span className="hdAv" aria-hidden="true">{p.author.init}</span>
                          <span className="hbRowTxt">
                            <b>{p.title || `${p.prop} · ${p.city}`}</b>
                            <small><span>{p.kind === "inspectie" ? "Inspecție" : "Raport + inspecție"}{p.due ? ` · ${new Date(`${p.due}T12:00:00Z`).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}` : ""} · {p.budget == null ? "onorariu de stabilit" : `${nf(p.budget)} lei`}{p.dist != null ? ` · ${p.dist < 4 ? "în localitate" : `${Math.round(p.dist)} km de tine`}` : ""}</span></small>
                          </span>
                          <span className="hbBtn line sm">Detalii</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="hbEmpty grow">
                      <i><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" /><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.8c1.9.7 3 2.6 3 5.2" /></svg></i>
                      <b>Niciun anunț în zonele tale</b>
                      <p>Ai nevoie de un coleg pentru o inspecție sau un raport? Postează un anunț: îl văd evaluatorii din zonă.</p>
                      <span className="hbActs"><a className="hbBtn dark" href="/colaborari?compose=1"><Plus />Postează un anunț</a><a className="hbBtn line" href="/colaborari?view=settings">Zonele mele</a></span>
                    </div>
                  )}
                  {myPost && (
                    <a className="hbRow" href="/colaborari?view=mine">
                      <span className="hdAv" style={{ background: "#F3EEE3", color: "#4A4A4A" }} aria-hidden="true">Eu</span>
                      <span className="hbRowTxt"><b>Anunțul tău · {myPost.title || `${myPost.prop}, ${myPost.city}`}</b><small><span>{myPost.status === "inlucru" ? "în lucru" : `activ ${ago(myPost.created_at).replace("acum ", "de ")}`} · {plural(myPost.requests.length, "cerere de detalii", "cereri de detalii")}</span></small></span>
                      <span className="hbBtn line sm">Vezi</span>
                    </a>
                  )}
                  {zone.length > 0 && (
                    <div className="hbRow push dashed">
                      <span className="hbRowTxt"><small><span>Ai nevoie de un coleg pentru o inspecție sau un raport?</span></small></span>
                      <a className="hbBtn dark sm" href="/colaborari?compose=1"><Plus />Postează un anunț</a>
                    </div>
                  )}
                  <a className={`hbRow${zone.length ? "" : " push"}`} href="/colaborari?view=chat">
                    <span className="hdNum" style={{ background: "#F3EEE3", color: "#141414" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg></span>
                    <span className="hbRowTxt"><b>Mesaje{cs.convs.length ? ` · ${plural(cs.convs.length, "conversație", "conversații")}` : ""}</b><small><span>{cs.convs.length ? (unread ? `${unread} necitite` : "nimic necitit") : "Nicio conversație încă: pornesc de la un anunț."}</span></small></span>
                    <span className="hbBtn line sm">Deschide</span>
                  </a>
                </>
              )}
            </section>
          ) : (
            <TodoCard todo={todo} grow />
          )}
        </div>

        {/* ---- the compact row ---- */}
        <div className={`hbRow2${collab ? "" : " two"}`}>
          {collab && <TodoCard todo={todo} />}
          {insp ? (
            <section className="hbCard cp" aria-labelledby="hbMonT">
              <div className="hbHead"><h2 id="hbMonT">Luna ta <small>· {monthName}</small></h2><a className="hbMore" href="/inspectii">Inspecții →</a></div>
              <div className={`hbKp${monthN ? "" : " zero"}`}>
                <div><b>{monthN}</b><small>inspecții finalizate</small></div>
                <div><b>{st?.avg_min ? <>{Math.round(st.avg_min)}<span> min</span></> : "–"}</b><small>timp mediu pe fișă</small></div>
                <div><b>{nf(ph?.n ?? 0)}</b><small>fotografii</small></div>
              </div>
              <div className="hbBars push" role="img" aria-label={`Inspecții finalizate pe săptămână, ultimele 8: ${bars.join(", ")}`}>
                {bars.map((v, i) => <i key={i} className={i === 7 && v ? "now" : ""} style={{ height: `${Math.max(14, Math.round((v / Math.max(1, ...bars)) * 100))}%` }} />)}
              </div>
              <small className="hbNote">{monthN ? `Pe săptămână, 8 săptămâni${aiN?.n ? ` · ${plural(aiN.n, "analiză AI", "analize AI")}` : ""}` : "Statisticile apar după prima inspecție finalizată."}</small>
            </section>
          ) : (
            <section className="hbCard cp" aria-labelledby="hbMonT">
              <div className="hbHead"><h2 id="hbMonT">Luna ta <small>· {monthName}</small></h2></div>
              <div className={`hbKp${recentEv.length || aiN?.n ? "" : " zero"}`}>
                <div><b>{nf(recentEv.filter((e) => e.at >= monthStart).length)}</b><small>imobile deschise</small></div>
                <div><b>{aiN?.n ?? 0}</b><small>analize AI</small></div>
                <div><b>{nf(list.length)}</b><small>localități cu plan</small></div>
              </div>
            </section>
          )}
          <section className="hbCard cp" aria-labelledby="hbActT">
            <div className="hbHead"><h2 id="hbActT">Activitate recentă</h2>{insp && <a className="hbMore" href="/inspectii">Inspecții →</a>}</div>
            {feed.length ? feed.map((f, i) => (
              <a key={i} className="hbLog" href={f.href}><small>{stamp(f.at)}</small><span>{f.who && <b>{f.who} </b>}{f.text}</span></a>
            )) : (
              <div className="hbEmpty grow">
                <i><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></i>
                <b>Încă nimic aici</b><p>Localizările, inspecțiile și mesajele colegilor se adună aici. Începe cu o căutare în bara de sus.</p>
                {loc && <span className="hbActs"><a className="hbBtn line sm" href="/localizare">Deschide harta cadastrală</a></span>}
              </div>
            )}
          </section>
        </div>

        {/* ---- the tools band ---- */}
        <div className="hbTools" aria-label="Instrumente">
          <span className="hbToolsCap">Instrumente</span>
          {loc && <a className="hbTool" href="/localizare"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z" /><circle cx="12" cy="11" r="2.2" /></svg></i>Localizator cadastral{list.length > 0 && <small>· {list.length} UAT</small>}</a>}
          {has("comparabile") && <a className="hbTool" href="/comparabile"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 20h16M7 16v-4M12 16V7M17 16v-6" /></svg></i>Localizator Comparabile</a>}
          {has("word") && <a className="hbTool" href="/word"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg></i>UVALO pentru Word{toolUse.get("word") ? <small>· instalat</small> : <em>Instalează</em>}</a>}
          {has("chrome") && <a className="hbTool" href="/chrome"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v6M3 12h6" /></svg></i>UVALO pentru Chrome{toolUse.get("chrome") ? <small>· instalat</small> : <em>Instalează</em>}</a>}
          <a className="hbTool" href="/suport"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg></i>Suport tehnic{supN ? <span className="navCount gold">{supN}</span> : <small>· tichet nou</small>}</a>
          <span className="hbTool soon"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 20h16M7 16v-4M12 16V7M17 16v-6" /></svg></i>Analize de piață<small>· în curând</small></span>
          <a className="hbMore push" href="/instrumente">Toate instrumentele →</a>
        </div>
      </div>
    </AppShell>
  );
}

/** "Necesită atenția ta": the open items with their action, or the green check when everything is up to date. */
function TodoCard({ todo, grow = false }: { todo: { ico: string; tone: string; title: string; sub: string; href: string; act: string; dark?: boolean }[]; grow?: boolean }) {
  return (
    <section className={`hbCard${grow ? "" : " cp"}`} aria-labelledby="hbTodoT">
      <div className="hbHead"><h2 id="hbTodoT">Necesită atenția ta</h2>{todo.length > 0 && <span className="navCount" style={{ marginLeft: 0 }}>{todo.length}</span>}</div>
      {todo.length ? todo.slice(0, grow ? 6 : 4).map((t) => (
        <a key={t.title + t.href} className="hbRow" href={t.href}>
          <span className={`hdNum t-${t.tone}`}>{t.ico}</span>
          <span className="hbRowTxt"><b title={t.title}>{t.title}</b><small title={t.sub}><span>{t.sub}</span></small></span>
          <span className={`hbBtn ${t.dark ? "dark" : "line"} sm`}>{t.act}</span>
        </a>
      )) : (
        <div className="hbEmpty grow ok">
          <i><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.3 2.3 4.7-5" /></svg></i>
          <b>Nimic de rezolvat</b><p>Fișele întoarse, solicitările și mesajele necitite apar aici.</p>
        </div>
      )}
    </section>
  );
}
