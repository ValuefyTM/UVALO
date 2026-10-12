"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CollabState, Person, Profile } from "@/lib/collab";
import { NotifyButton } from "./NotifyButton";
import { COUNTIES, KINDS, POST_SPECS, PROPS, SKILL_SUGGESTIONS, YEARS, type CollabMode, type Kind } from "@/lib/collab-shared";

type State = CollabState & { mode: CollabMode };
type FeedPost = State["feed"][number];
type View = "feed" | "mine" | "chat" | "settings";

/* ---------- small helpers ---------- */

async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/colaborari", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const d = ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, unknown> & { error?: string };
  if (!r?.ok) return { error: d.error || "Nu am putut salva. Verifică conexiunea și încearcă din nou." } as Record<string, unknown> & { error: string };
  return d;
}

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "chiar acum";
  if (m < 60) return `acum ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "acum o oră" : `acum ${h} ore`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `acum ${d} zile`;
}
/** Relative time; the server and the browser render it a few seconds apart, so a different minute is not an error. */
const Ago = ({ iso }: { iso: string }) => <span suppressHydrationWarning>{ago(iso)}</span>;
const hhmm = (iso: string) => new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
const dayMonth = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
/** "Lugoj, Timiș", or just "Arad" when the town and the county share the name. */
const where = (p: { city: string; county: string }) => (p.city.trim().toLowerCase() === p.county.toLowerCase() ? p.city : `${p.city}, ${p.county}`);
const distLabel = (d: number | null) => (d == null ? null : d < 4 ? "în localitate" : `≈ ${Math.round(d)} km`);
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });

function dueChip(due: string | null) {
  if (!due) return { label: "Fără termen", hot: false };
  const n = Math.round((new Date(`${due}T12:00:00Z`).getTime() - new Date(`${todayIso()}T12:00:00Z`).getTime()) / 864e5);
  if (n <= 3) return { label: n < 0 ? `Termen depășit (${dayMonth(due)})` : n === 0 ? "Termen azi" : n === 1 ? "Termen mâine" : `Termen în ${n} zile`, hot: true };
  return { label: `Termen ${dayMonth(due)}`, hot: false };
}
const fee = (b: number | null) => (b == null ? { k: "Onorariu", v: "de stabilit", none: true } : { k: "Buget", v: `${b.toLocaleString("ro-RO")} lei`, none: false });

function Av({ p, size = 36, square = false }: { p: Pick<Person, "id" | "init" | "avatar">; size?: number; square?: boolean }) {
  const style = { width: size, height: size, borderRadius: square ? 9 : 999, fontSize: size < 30 ? 10 : 12 };
  // eslint-disable-next-line @next/next/no-img-element
  return p.avatar ? <img className="cbAv" src={`/api/avatar/${p.id}`} alt="" style={style} /> : <span className="cbAv" style={style} aria-hidden="true">{p.init}</span>;
}
const KindTag = ({ k }: { k: Kind }) => <span className={`cbTag cbTag-${k}`}>{k === "inspectie" ? "INSPECȚIE" : "RAPORT + INSPECȚIE"}</span>;

/* ---------- the module ---------- */

export function Colaborari({ initial, splash, firmsAsked = false }: { initial: State; splash: boolean; firmsAsked?: boolean }) {
  const [s, setS] = useState(initial);
  const [view, setView] = useState<View>("feed");
  const [zone, setZone] = useState<"colegi" | "firme">("colegi");
  const [mineTab, setMineTab] = useState<"posts" | "req">("posts");
  const [conv, setConv] = useState<string | null>(initial.convs[0]?.id ?? null);
  const [hl, setHl] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const reload = useCallback(async () => {
    const r = await fetch("/api/colaborari", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setS(await r.json());
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") reload(); }, 30000);
    return () => clearInterval(t);
  }, [reload]);

  const go = (g: { view?: string; conv?: string; hl?: string; tab?: string }) => {
    setNotifOpen(false);
    if (g.view === "chat") { setView("chat"); if (g.conv) setConv(g.conv); }
    else if (g.view === "mine") { setView("mine"); setMineTab(g.tab === "req" ? "req" : "posts"); }
    else { setView("feed"); setZone("colegi"); setHl(g.hl ?? null); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? "" : t)), 6000); };

  const unreadMsg = s.convs.reduce((n, c) => n + c.unread, 0);
  const newReqs = s.mine.reduce((n, p) => n + p.requests.filter((r) => r.status === "nou").length, 0);
  const unreadNotifs = s.notifs.filter((n) => !n.read).length;

  if (!s.profile) return (
    <>
      {s.mode !== "on" && <TestStrip mode={s.mode} />}
      <Setup s={s} onDone={async (m) => { await reload(); flash(m); }} />
      {splash && <CollabSplash here />}
    </>
  );

  const tabs: [View, string, number][] = [["feed", "Anunțuri", 0], ["mine", "Anunțurile mele", newReqs], ["chat", "Mesaje", unreadMsg], ["settings", "Zone de acoperire", 0]];
  return (
    <div className="cb">
      {s.mode !== "on" && <TestStrip mode={s.mode} />}
      <div className="cbBar">
        <nav className="cbTabs" aria-label="Colaborări">
          {tabs.map(([v, l, n]) => (
            <button key={v} type="button" className="cbTab" aria-current={view === v ? "page" : undefined} onClick={() => { setView(v); setNotifOpen(false); }}>
              {l}{n > 0 && <span className="cbBadge">{n}</span>}
            </button>
          ))}
        </nav>
        <div className="cbBarRight">
          <div className="cbNotifWrap">
            <button type="button" className="cbTab cbIconTab" aria-label="Notificări" aria-expanded={notifOpen} onClick={() => setNotifOpen(!notifOpen)}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              <span className="cbLbl">Notificări</span>{unreadNotifs > 0 && <span className="cbBadge">{unreadNotifs}</span>}
            </button>
            {notifOpen && <Notifs s={s} onGo={async (n) => { go(n.go as never); if (!n.read) { await call({ action: "read", id: n.id }); reload(); } }} onReadAll={async () => { await call({ action: "read" }); reload(); }} onZones={() => { setView("settings"); setNotifOpen(false); }} />}
          </div>
          <button type="button" className="cbTab cbIconTab" aria-label="Profilul meu" onClick={() => setProfileOpen(true)}><Av p={s.me} size={22} /><span className="cbLbl">Profilul meu</span></button>
          <button type="button" className="btn btnNavy btnSm cbPublish" onClick={() => { setView("feed"); setZone("colegi"); setComposeOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>+ Publică anunț</button>
        </div>
      </div>
      {toast && <div className="cbToast" role="status"><span>{toast}</span><button type="button" className="linkBtn" onClick={() => setToast("")}>Închide</button></div>}

      {view === "feed" && <Feed s={s} firmsAsked={firmsAsked} zone={zone} setZone={setZone} hl={hl} composeOpen={composeOpen} setComposeOpen={setComposeOpen} reload={reload} flash={flash}
        toMine={() => go({ view: "mine" })} toSettings={() => setView("settings")} />}
      {view === "mine" && <Mine s={s} tab={mineTab} setTab={setMineTab} reload={reload} flash={flash} openChat={(id) => { setConv(id); setView("chat"); }} />}
      {view === "chat" && <Chat s={s} active={conv} setActive={setConv} reload={reload} flash={flash} />}
      {view === "settings" && <Zones s={s} onSaved={async (m) => { await reload(); flash(m); }} toFeed={() => setView("feed")} />}
      {profileOpen && <ProfileModal s={s} onClose={() => setProfileOpen(false)} onSaved={async () => { setProfileOpen(false); await reload(); flash("Profilul a fost salvat."); }} />}
    </div>
  );
}

function TestStrip({ mode }: { mode: CollabMode }) {
  return (
    <div className="cbTest" role="note">
      <b>{mode === "test" ? "Mod test" : "Dezactivat pentru utilizatori"}</b>
      <span>{mode === "test" ? "Colaborările sunt deschise doar unui grup de test. Anunțurile, cererile și mesajele de acum se pot șterge de administratori." : "Doar administratorii UVALO văd modulul. Datele introduse acum sunt date de test."}</span>
    </div>
  );
}

/* ---------- notifications ---------- */

function Notifs({ s, onGo, onReadAll, onZones }: { s: State; onGo: (n: State["notifs"][number]) => void; onReadAll: () => void; onZones: () => void }) {
  return (
    <div className="cbNotifs">
      <div className="cbNotifsHead"><b>Notificări</b>{s.notifs.some((n) => !n.read) && <button type="button" className="linkBtn" onClick={onReadAll}>Marchează toate ca citite</button>}</div>
      <div className="cbNotifsList">
        {s.notifs.length === 0 && <p className="cbEmptySmall">Nicio notificare încă.</p>}
        {s.notifs.map((n) => (
          <button key={n.id} type="button" className={`cbNotif${n.read ? "" : " unread"}`} onClick={() => onGo(n)}>
            <span className="cbNotifText">{n.text}</span>
            <span className="cbNotifMeta">{n.type} · <Ago iso={n.created_at} /></span>
          </button>
        ))}
      </div>
      <div className="cbNotifsFoot">Notificările vin doar în aplicație, pentru anunțurile din <button type="button" className="linkBtn" onClick={onZones}>zonele tale de acoperire</button>.</div>
    </div>
  );
}

/* ---------- feed ---------- */

function zoneText(z: Profile) {
  if (!z.available) return "Nu primești notificări: ai ales „doar mă uit”.";
  const home = z.county ? (z.zone_mode === "judet" ? `Tot județul ${z.county}` : `${z.city || z.county}, rază de ${z.radius} km`) : "Locație de bază nesetată";
  const k = z.kinds.map((x) => (x === "inspectie" ? "inspecții" : "rapoarte + inspecție")).join(" și ") || "niciun tip de lucrare";
  return `${home}${z.extra.length ? ` · plus ${z.extra.join(", ")}` : ""} · ${k}`;
}

function Feed({ s, firmsAsked, zone, setZone, hl, composeOpen, setComposeOpen, reload, flash, toMine, toSettings }: {
  s: State; firmsAsked: boolean; zone: "colegi" | "firme"; setZone: (z: "colegi" | "firme") => void; hl: string | null; composeOpen: boolean; setComposeOpen: (b: boolean) => void;
  reload: () => Promise<void>; flash: (m: string) => void; toMine: () => void; toSettings: () => void;
}) {
  const z = s.profile!;
  const [scope, setScope] = useState<"zone" | "all">(z.available ? "zone" : "all");
  const [sort, setSort] = useState<"noi" | "aproape" | "termen">("noi");
  const [county, setCounty] = useState("");
  const [prop, setProp] = useState("");
  const [spec, setSpec] = useState("");
  const inZoneCount = s.feed.filter((p) => p.inZone && !p.own).length;
  const base = s.feed.filter((p) => scope === "all" || p.inZone || p.own);
  const list = base.filter((p) => (!county || p.county === county) && (!prop || p.prop === prop) && (!spec || p.spec === spec)).sort((a, b) =>
    sort === "aproape" ? (a.dist ?? 1e9) - (b.dist ?? 1e9) : sort === "termen" ? (a.due ?? "9999").localeCompare(b.due ?? "9999") : b.created_at.localeCompare(a.created_at));
  useEffect(() => { if (hl) document.getElementById(`p-${hl}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [hl]);
  const uniq = (a: (string | null)[]) => [...new Set(a.filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y, "ro"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const active = [county, prop, spec, sort !== "noi" ? sort : ""].filter(Boolean).length;
  const scopeSeg = (
    <div className="cbSeg">
      {([["zone", "Zonele mele"], ["all", "Toate zonele"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)}>{l}</button>)}
    </div>
  );
  const filterControls = (
    <>
      <select className="select" aria-label="Ordinea" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
        <option value="noi">Cele mai noi</option><option value="aproape">Cele mai apropiate</option><option value="termen">Termen cel mai apropiat</option>
      </select>
      <small className="cbLabel">FILTRE</small>
      <select className="select" aria-label="Județul" value={county} onChange={(e) => setCounty(e.target.value)}>
        <option value="">Toate județele</option>{uniq(base.map((p) => p.county)).map((c) => <option key={c}>{c}</option>)}
      </select>
      <select className="select" aria-label="Tipul proprietății" value={prop} onChange={(e) => setProp(e.target.value)}>
        <option value="">Orice tip de proprietate</option>{uniq(base.map((p) => p.prop)).map((c) => <option key={c}>{c}</option>)}
      </select>
      <div className="cbChips">
        {["", "EPI", "EI", "EBM"].map((v) => <button key={v || "all"} type="button" className="cbChip" aria-pressed={spec === v} onClick={() => setSpec(v)}>{v || "Toate"}</button>)}
      </div>
      <span className="cbCount">{list.length === 1 ? "1 anunț" : `${list.length} anunțuri`}{active > 0 && <> · <button type="button" className="linkBtn" onClick={() => { setCounty(""); setProp(""); setSpec(""); setSort("noi"); }}>Resetează</button></>}</span>
    </>
  );

  return (
    <div className="cbFeed">
      <div className="cbZoneSwitch" role="group" aria-label="Anunțuri">
        <button type="button" aria-pressed={zone === "colegi"} onClick={() => setZone("colegi")}>De la colegi <span className="cbSwCount">{inZoneCount}</span></button>
        <button type="button" aria-pressed={zone === "firme"} onClick={() => setZone("firme")}>De la firme <small>în curând</small></button>
      </div>
      <div className="cbZones">
        <button type="button" className="cbZone" aria-pressed={zone === "colegi"} onClick={() => setZone("colegi")}>
          <span><small>DE LA COLEGI</small><b>Lucrări ocazionale</b><em>Inspecții și rapoarte + inspecție în zonele tale</em></span><strong>{inZoneCount}</strong>
        </button>
        <button type="button" className="cbZone" aria-pressed={zone === "firme"} onClick={() => setZone("firme")}>
          <span><small>DE LA FIRME</small><b>Angajare</b><em>În curând: anunțuri de angajare de la firme</em></span>
        </button>
      </div>
      {zone === "firme" ? (
        <div className="cbSoon">
          <span className="cbSoonTag">ÎN CURÂND</span>
          <h2>Aici vor fi anunțuri din partea firmelor</h2>
          <p>Angajări și colaborări pe termen lung publicate de firmele de evaluare. Până atunci, vezi lucrările ocazionale de la colegi.</p>
          <div className="cbSoonActs">
            <button type="button" className="btn btnGold" onClick={() => setZone("colegi")}>Vezi lucrările de la colegi →</button>
            <NotifyButton k="angajare" done={firmsAsked} label="Anunță-mă, vreau să postez" />
          </div>
          <small className="cbMuted">Pentru firmele care vor să publice anunțuri de angajare: te anunțăm când se deschide.</small>
        </div>
      ) : (
        <>
          <div className="cbZoneStrip"><small>ZONA TA</small><span>{zoneText(z)}</span><button type="button" className="linkBtn" onClick={toSettings}>Modifică zonele →</button></div>
          <div className="cbFeedGrid">
            <div className="cbCol">
              <div className="cbMobFilters">
                <div className="cbMobRow">
                  {scopeSeg}
                  <button type="button" className="cbTab" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                    Filtre{active > 0 && <span className="cbBadge">{active}</span>}
                  </button>
                </div>
                {filtersOpen && <div className="cbBox">{filterControls}</div>}
              </div>
              <Composer s={s} open={composeOpen} setOpen={setComposeOpen} onDone={async (m) => { await reload(); setScope("zone"); flash(m); }} />
              {list.length === 0 && (
                <div className="cbEmpty">
                  <b>{scope === "zone" ? (z.available ? "Niciun anunț în zonele tale pentru filtrele alese" : "Nu ai setat o zonă") : "Niciun anunț pentru filtrele alese"}</b>
                  {scope === "zone" ? <button type="button" className="linkBtn" onClick={() => setScope("all")}>Vezi anunțurile din toate zonele</button>
                    : (county || prop || spec) && <button type="button" className="linkBtn" onClick={() => { setCounty(""); setProp(""); setSpec(""); }}>Resetează filtrele</button>}
                </div>
              )}
              {list.map((p) => <PostCard key={p.id} p={p} s={s} hl={hl === p.id} outZone={scope === "all" && !p.inZone && !p.own} reload={reload} flash={flash} toMine={toMine} />)}
            </div>
            <aside className="cbSide cbFeedSide">
              <div className="cbBox">
                <small className="cbLabel">AFIȘARE</small>
                {scopeSeg}
                {filterControls}
              </div>
              <div className="cbBox dark">
                <small className="cbLabel">LOCAȚIA TA DE BAZĂ</small>
                <b>{[z.address, z.city, z.county].filter(Boolean).join(", ") || "Nesetată"}</b>
                <span>{z.lat != null ? "Distanțele sunt estimate pe drum de la această adresă." : "Nu am putut localiza adresa: distanțele nu se calculează. Verific-o în Zone de acoperire."}</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function PostCard({ p, s, hl, outZone, reload, flash, toMine }: { p: FeedPost; s: State; hl: boolean; outZone: boolean; reload: () => Promise<void>; flash: (m: string) => void; toMine: () => void }) {
  const [composing, setComposing] = useState(false);
  const [askAvail, setAskAvail] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const d = dueChip(p.due), f = fee(p.budget), z = s.profile!;
  const send = async () => {
    setBusy(true); setError("");
    const r = await call({ action: "request", post_id: p.id, msg });
    setBusy(false);
    if (r.error) return setError(r.error);
    setComposing(false); await reload(); flash("Cererea a fost trimisă. Autorul îți vede profilul și te contactează în Mesaje.");
  };
  return (
    <article id={`p-${p.id}`} className={`cbPost${hl ? " hl" : ""}`}>
      <div className="cbPostHead">
        <Av p={p.author} />
        <span className="cbWho"><b>{p.author.name}</b><small>{p.author.sub ? `${p.author.sub} · ` : ""}<Ago iso={p.created_at} /></small></span>
        {outZone && <span className="cbOut">În afara zonei</span>}
        <KindTag k={p.kind} />
      </div>
      <div className="cbPostBody"><h3>{p.title}</h3><p>{p.note}</p></div>
      <div className="cbFacts">
        <span className="cbLoc">{where(p)}{distLabel(p.dist) && <em>{distLabel(p.dist)}</em>}</span>
        {p.prop && <span className="cbFact">{p.prop}</span>}
        {p.spec && <span className="cbFact">{p.spec}</span>}
        <span className={`cbFact${d.hot ? " hot" : ""}`}><b>{d.label}</b></span>
        <span className="cbFact line">{f.k}: <b className={f.none ? "muted" : ""}>{f.v}</b></span>
      </div>
      <div className="cbPostFoot">
        <span className="cbMuted">{p.requests === 0 ? "Nimeni nu a cerut încă detalii" : p.requests === 1 ? "1 coleg a cerut detalii" : `${p.requests} colegi au cerut detalii`}</span>
        {p.own ? (
          <span className="cbOwn"><span className="cbMuted">Postarea ta</span><button type="button" className="btn btnGhost btnSm" onClick={toMine}>Vezi cererile →</button></span>
        ) : p.myRequest ? (
          <span className="cbDone"><b>✓ {p.myRequest === "contactat" || p.myRequest === "ales" ? "Autorul te-a contactat" : "Detalii cerute"}</b><small>{p.myRequest === "nou" ? "Autorul te va contacta" : "vezi Mesaje"}</small></span>
        ) : !composing && (
          <button type="button" className="btn btnGold btnSm" onClick={() => (z.available ? setComposing(true) : setAskAvail(true))}>Vreau detalii</button>
        )}
      </div>
      {askAvail && <AvailModal s={s} onClose={() => setAskAvail(false)} onDone={async () => { setAskAvail(false); await reload(); setComposing(true); flash("Ești disponibil pentru colaborări. Acum poți cere detalii."); }} />}
      {composing && (
        <div className="cbApply">
          <ProfilePreview s={s} z={z} />
          <label className="field">Mesaj către autor <small>(opțional)</small>
            <textarea className="textarea" rows={2} value={msg} maxLength={1000} onChange={(e) => setMsg(e.target.value)} placeholder="De ce te interesează lucrarea, când poți face inspecția…" />
          </label>
          {error && <div role="alert" className="error">{error}</div>}
          <div className="cbApplyFoot">
            <span className="cbMuted">Autorul îți primește profilul și mesajul, apoi te contactează în Mesaje. Datele de contact apar după ce începe conversația.</span>
            <button type="button" className="linkBtn" onClick={() => setComposing(false)}>Anulează</button>
            <button type="button" className="btn btnNavy btnSm" disabled={busy} onClick={send}>{busy ? "Se trimite…" : "Trimite cererea"}</button>
          </div>
        </div>
      )}
    </article>
  );
}

/** "Doar mă uit" profiles: asking for details first turns on the availability and sets the zone. */
function AvailModal({ s, onClose, onDone }: { s: State; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useZoneForm(s);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const save = async () => {
    if (!f.city.trim()) return setError("Scrie localitatea de bază, ca să-ți calculăm zona.");
    setBusy(true); setError("");
    const r = await call({ action: "profile", ...f, available: true, kinds: f.kinds.length ? f.kinds : ["inspectie", "raport"] });
    setBusy(false);
    if (r.error) return setError(r.error);
    await onDone();
  };
  return (
    <div className="cbModal" role="dialog" aria-modal="true" aria-labelledby="cbAvailT" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cbModalBox" style={{ maxWidth: 620 }}>
        <div className="cbModalHead"><span className="cbWho"><b id="cbAvailT">Activează-ți disponibilitatea</b><small>Ca să ceri detalii la un anunț, trebuie să fii disponibil pentru colaborări și să ai o zonă de lucru.</small></span><button type="button" className="cbX" aria-label="Închide" onClick={onClose}>×</button></div>
        <div className="cbModalBody">
          <p className="cbNote">La activare ai ales „Deocamdată doar mă uit”. Setează-ți zona: de aici se calculează distanțele, iar notificările pentru lucrările noi din zonă le primești în aplicație.</p>
          <div className="cbGrid3">
            <label className="field">Adresă de bază <small>(opțional)</small><input className="input" value={f.address} maxLength={160} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="ex. Str. Paris 12" /></label>
            <label className="field">Localitate<input className="input" value={f.city} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="ex. Timișoara" /></label>
            <label className="field">Județ<select className="select" value={f.county} onChange={(e) => setF({ ...f, county: e.target.value, extra: f.extra.filter((x) => x !== e.target.value) })}>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <div className="cbSeg">
            <button type="button" aria-pressed={f.zone_mode === "raza"} onClick={() => setF({ ...f, zone_mode: "raza" })}>Rază în jurul adresei</button>
            <button type="button" aria-pressed={f.zone_mode === "judet"} onClick={() => setF({ ...f, zone_mode: "judet" })}>Tot județul {f.county}</button>
          </div>
          {f.zone_mode === "raza" && <Radius value={f.radius} onChange={(v) => setF({ ...f, radius: v })} />}
          <div className="field">Alte județe <small>(opțional)</small><ExtraCounties home={f.county} value={f.extra} onChange={(extra) => setF({ ...f, extra })} /></div>
        </div>
        <div className="cbModalFoot">
          <span className={error ? "error" : "cbMuted"}>{error || "Le poți schimba oricând din „Zone de acoperire”."}</span>
          <button type="button" className="linkBtn" onClick={onClose}>Anulează</button>
          <button type="button" className="btn btnGold btnSm" disabled={busy} onClick={save}>{busy ? "Se salvează…" : "Activează și cere detalii"}</button>
        </div>
      </div>
    </div>
  );
}

function ProfilePreview({ s, z }: { s: State; z: Profile }) {
  return (
    <div className="cbPreview">
      <div className="cbPreviewHead"><small className="cbLabel">PROFILUL TRIMIS</small><small className="cbMuted">se modifică din Profilul meu</small></div>
      <div className="cbPreviewWho"><Av p={s.me} size={34} /><span><b>{s.me.name}{s.me.anevar ? ` · ANEVAR ${s.me.anevar}` : ""}</b><small>{["Titular ANEVAR", s.me.specs.join(", "), z.years ? `${z.years} experiență` : null].filter(Boolean).join(" · ")}</small></span></div>
      {z.skills.length > 0 && <div className="cbChips">{z.skills.slice(0, 8).map((k) => <span key={k} className="cbSkill">{k}</span>)}</div>}
    </div>
  );
}

function Composer({ s, open, setOpen, onDone }: { s: State; open: boolean; setOpen: (b: boolean) => void; onDone: (m: string) => Promise<void> }) {
  const blank = () => ({ note: "", kind: "" as Kind | "", title: "", city: s.profile?.city ?? "", county: s.profile?.county ?? s.me.county ?? "", prop: "", spec: "EPI", due: "", budget: "", tbd: true });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ok = f.note.trim().length >= 10 && f.kind && f.city.trim() && f.county;
  const hint = f.note.trim().length < 10 ? "Descrie lucrarea: proprietatea, accesul, ce trebuie făcut." : !f.kind ? "Alege tipul anunțului." : !f.city.trim() || !f.county ? "Alege localitatea și județul, ca anunțul să ajungă la colegii din zonă." : "Gata de publicat. Colegii din zonă primesc notificare în aplicație.";
  const publish = async () => {
    if (!ok) { setOpen(true); setError(hint); return; }
    setBusy(true); setError("");
    const r = await call({ action: "post", ...f, budget: f.tbd ? null : f.budget, due: f.due || null });
    setBusy(false);
    if (r.error) return setError(r.error);
    const n = Number(r.notified) || 0;
    setF(blank()); setOpen(false);
    await onDone(`Anunțul a fost publicat. ${n === 0 ? "Deocamdată niciun coleg nu are zona aici." : n === 1 ? "Un coleg din zonă a primit notificare." : `${n} colegi din zonă au primit notificare.`}`);
  };
  return (
    <div className={`cbCompose${open ? " open" : ""}`}>
      <div className="cbComposeTop">
        <Av p={s.me} />
        <textarea className="cbComposeText" aria-label="Descrierea lucrării" rows={open ? 4 : 1} value={f.note} maxLength={2000} onFocus={() => setOpen(true)} onChange={(e) => setF({ ...f, note: e.target.value })}
          placeholder="Scrie de ce ai nevoie: proprietatea, accesul, ce trebuie făcut…" />
      </div>
      <div className="cbComposeRow">
        {(Object.keys(KINDS) as Kind[]).map((k) => <button key={k} type="button" className="cbChip" aria-pressed={f.kind === k} onClick={() => { setF({ ...f, kind: k }); setOpen(true); }}>{KINDS[k]}</button>)}
        <span style={{ flex: 1 }} />
        {!open && <button type="button" className="linkBtn" onClick={() => setOpen(true)}>+ Detalii lucrare</button>}
        <button type="button" className="btn btnGold btnSm" disabled={busy} onClick={publish}>{busy ? "Se publică…" : "Publică"}</button>
      </div>
      {open && (
        <>
          <div className="cbComposeGrid">
            <label className="field cbWide">Titlu <small>(opțional; implicit tipul proprietății și localitatea)</small><input className="input" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="ex. Apartament 3 camere, bloc 1985" /></label>
            <label className="field">Localitate<input className="input" value={f.city} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="ex. Lugoj" /></label>
            <label className="field">Județ<select className="select" value={f.county} onChange={(e) => setF({ ...f, county: e.target.value })}><option value="">Alege…</option>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Tip proprietate<select className="select" value={f.prop} onChange={(e) => setF({ ...f, prop: e.target.value })}><option value="">Alege…</option>{PROPS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Specializare<select className="select" value={f.spec} onChange={(e) => setF({ ...f, spec: e.target.value })}>{POST_SPECS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">Termen<input className="input" type="date" min={todayIso()} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
            <div className="field">Onorariu
              {!f.tbd && <input className="input" inputMode="numeric" aria-label="Buget în lei" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/\D/g, "").slice(0, 7) })} placeholder="Buget, ex. 300 (lei)" />}
              <label className="check"><input type="checkbox" checked={f.tbd} onChange={(e) => setF({ ...f, tbd: e.target.checked })} />De stabilit</label>
            </div>
          </div>
          <div className="cbComposeFoot"><span className={error ? "error" : "cbMuted"}>{error || hint}</span><button type="button" className="linkBtn" onClick={() => setOpen(false)}>Ascunde detaliile</button></div>
        </>
      )}
    </div>
  );
}

/* ---------- my posts and my requests ---------- */

const REQ_ST: Record<string, [string, string]> = { nou: ["Nou", "new"], contactat: ["În discuție", ""], ales: ["Ales", "ok"] };

function Mine({ s, tab, setTab, reload, flash, openChat }: { s: State; tab: "posts" | "req"; setTab: (t: "posts" | "req") => void; reload: () => Promise<void>; flash: (m: string) => void; openChat: (id: string) => void }) {
  const [busy, setBusy] = useState("");
  const act = async (key: string, body: Record<string, unknown>, done?: (r: Record<string, unknown>) => void | Promise<void>) => {
    setBusy(key);
    const r = await call(body);
    setBusy("");
    if (r.error) return flash(r.error);
    await reload();
    await done?.(r);
  };
  return (
    <div className="cbPage">
      <div className="cbSeg big" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "posts"} onClick={() => setTab("posts")}>Postările mele · {s.mine.length}</button>
        <button type="button" role="tab" aria-selected={tab === "req"} onClick={() => setTab("req")}>Detalii cerute · {s.myRequests.length}</button>
      </div>
      {tab === "posts" && (
        <>
          {s.mine.length === 0 && <div className="cbEmpty"><b>Nu ai publicat încă niciun anunț</b><span className="cbMuted">Din „+ Publică anunț” ceri ajutor la o inspecție sau predai o lucrare.</span></div>}
          {s.mine.map((p) => {
            const st = p.status === "archived" ? ["Arhivat", ""] : p.status === "inlucru" ? ["În lucru · scos din feed", "ok"] : ["Activ", "acc"];
            const nNew = p.requests.filter((r) => r.status === "nou").length;
            return (
              <article key={p.id} className="cbMine">
                <div className="cbMineHead">
                  <div className="cbMineTop"><KindTag k={p.kind} /><span className="cbMuted">Publicat <Ago iso={p.created_at} /></span><span className={`cbSt ${st[1]}`}>{st[0]}</span></div>
                  <h3>{p.title}</h3>
                  <div className="cbFacts"><span className="cbLoc">{where(p)}</span>{p.prop && <span className="cbFact">{p.prop}</span>}{p.spec && <span className="cbFact">{p.spec}</span>}<span className="cbFact">{dueChip(p.due).label}</span><span className="cbFact">{fee(p.budget).k} {fee(p.budget).v}</span></div>
                </div>
                <div className="cbMineSub">
                  <small className="cbLabel">{p.requests.length === 1 ? "1 COLEG A CERUT DETALII" : `${p.requests.length} COLEGI AU CERUT DETALII`}{nNew ? ` · ${nNew} NOI` : ""}</small>
                  <button type="button" className="linkBtn" disabled={!!busy} onClick={() => act(`st-${p.id}`, { action: "status", post_id: p.id, archive: p.status !== "archived" }, () => flash(p.status === "archived" ? "Anunțul a fost restaurat." : "Anunțul a fost arhivat."))}>
                    {p.status === "archived" ? "Restaurează" : "Arhivează"}
                  </button>
                </div>
                <div className="cbReqs">
                  {p.requests.length === 0 && <p className="cbEmptySmall">Încă nu a cerut nimeni detalii.</p>}
                  {p.requests.map((r) => {
                    const [l, cls] = REQ_ST[r.status] ?? [r.status, ""];
                    return (
                      <div key={r.id} className={`cbReq${r.status === "nou" ? " new" : ""}`}>
                        <Av p={r.user} />
                        <div className="cbReqText">
                          <div className="cbReqName"><b>{r.user.name}</b><small>{r.user.sub} · <Ago iso={r.created_at} /></small><span className={`cbSt ${cls}`}>{l}</span></div>
                          {(r.base || r.dist != null) && <span className="cbReqMeta">{r.base ? `Bază: ${r.base}` : ""}{r.dist != null ? `${r.base ? " · " : ""}${distLabel(r.dist)} de proprietate` : ""}{r.years ? ` · ${r.years} experiență` : ""}</span>}
                          {r.skills.length > 0 && <div className="cbChips">{r.skills.slice(0, 6).map((k) => <span key={k} className="cbSkill">{k}</span>)}</div>}
                          {r.msg && <q className="cbQuote">{r.msg}</q>}
                          {r.conv_id ? (
                            <span className="cbContact">{r.user.phone && <a href={`tel:${r.user.phone.replace(/\s/g, "")}`}>{r.user.phone}</a>}{r.user.email && <a href={`mailto:${r.user.email}`}>{r.user.email}</a>}</span>
                          ) : <small className="cbMuted">Telefonul și emailul apar după ce deschizi conversația.</small>}
                        </div>
                        <div className="cbReqActs">
                          <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => r.conv_id ? openChat(r.conv_id) : act(`c-${r.id}`, { action: "open_chat", request_id: r.id }, (x) => openChat(String(x.id)))}>
                            {busy === `c-${r.id}` ? "…" : r.conv_id ? "Deschide chat" : "Începe chat"}
                          </button>
                          {!p.chosen_id && p.status !== "archived" && (
                            <button type="button" className="btn btnGold btnSm" disabled={!!busy} onClick={() => confirm(`Îl alegi pe ${r.user.name} pentru „${p.title}”? Anunțul trece „În lucru” și iese din feed.`) && act(`k-${r.id}`, { action: "pick", request_id: r.id }, () => flash(`L-ai ales pe ${r.user.name}. Lucrarea e „În lucru”; o arhivezi când vrei.`))}>
                              Alege pentru lucrare
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </>
      )}
      {tab === "req" && (
        <>
          {s.myRequests.length === 0 && <div className="cbEmpty"><b>Nu ai cerut încă detalii la niciun anunț</b></div>}
          {s.myRequests.map((r) => {
            const st = r.status === "ales" ? ["Ai fost ales", "ok"] : r.status === "contactat" ? ["Te-a contactat", "ok"] : r.post.status !== "active" ? ["Atribuit altui coleg", ""] : ["Așteaptă răspuns", ""];
            return (
              <div key={r.id} className="cbMyReq">
                <Av p={r.post.author} />
                <span className="cbWho"><b>{r.post.title}</b><small>{r.post.author.name} · {where(r.post)}{distLabel(r.post.dist) ? ` (${distLabel(r.post.dist)})` : ""} · cerere trimisă <Ago iso={r.created_at} /></small></span>
                <span className={`cbSt ${st[1]}`}>{st[0]}</span>
                {r.conv_id && <button type="button" className="btn btnNavy btnSm" onClick={() => openChat(r.conv_id!)}>Deschide chat</button>}
                {r.status !== "ales" && <button type="button" className="linkBtn" disabled={!!busy} onClick={() => confirm("Îți retragi cererea?") && act(`w-${r.id}`, { action: "withdraw", id: r.id }, () => flash("Cererea a fost retrasă."))}>Retrage</button>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ---------- messages ---------- */

type Msg = { id: number; body: string; sys: boolean; me: boolean; at: string };

function Chat({ s, active, setActive, reload, flash }: { s: State; active: string | null; setActive: (id: string) => void; reload: () => Promise<void>; flash: (m: string) => void }) {
  const c = s.convs.find((x) => x.id === active) ?? null;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/colaborari?conv=${encodeURIComponent(id)}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setMsgs(((await r.json()) as { messages: Msg[] }).messages);
  }, []);
  useEffect(() => {
    if (!active) return;
    setMsgs([]);
    load(active).then(reload);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(active); }, 6000);
    return () => clearInterval(t);
  }, [active, load, reload]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs.length]);
  const send = async () => {
    const t = draft.trim();
    if (!t || !c) return;
    setBusy(true);
    const r = await call({ action: "message", conv_id: c.id, body: t });
    setBusy(false);
    if (r.error) return flash(r.error);
    setDraft(""); await load(c.id);
  };
  const pick = async () => {
    if (!c || !confirm(`Îl alegi pe ${c.peer.name} pentru „${c.post.title}”? Anunțul trece „În lucru” și iese din feed.`)) return;
    const r = await call({ action: "pick", request_id: c.request_id });
    if (r.error) return flash(r.error);
    await reload(); await load(c.id);
  };
  const stLabel = c ? (c.state === "ales" ? (c.role === "author" ? "Ales pentru lucrare · În lucru" : "Ai fost ales · În lucru") : c.state === "altul" ? "Atribuit altui coleg" : c.state === "arhivat" ? "Anunț arhivat" : c.role === "requester" ? "Ai cerut detalii" : "") : "";

  if (s.convs.length === 0) return <div className="cbPage"><div className="cbEmpty"><b>Nicio conversație încă</b><span className="cbMuted">Conversațiile încep când autorul unui anunț răspunde la o cerere de detalii.</span></div></div>;
  return (
    <div className={`cbChat${c ? " hasActive" : ""}`}>
      <div className="cbConvs">
        {s.convs.map((x) => (
          <button key={x.id} type="button" className="cbConv" aria-current={x.id === active ? "true" : undefined} onClick={() => setActive(x.id)}>
            <Av p={x.peer} size={38} />
            <span className="cbConvText"><b>{x.peer.name}</b><em>{x.post.title}</em><small className={x.unread ? "unread" : ""}>{x.last ? `${x.last.me ? "Tu: " : ""}${x.last.body}` : ""}</small></span>
            <span className="cbConvMeta"><small><Ago iso={x.last_at} /></small>{x.unread > 0 && <span className="cbBadge">{x.unread}</span>}</span>
          </button>
        ))}
      </div>
      {c ? (
        <div className="cbThread">
          <div className="cbThreadHead">
            <button type="button" className="linkBtn cbBack" onClick={() => setActive("")}>←</button>
            <Av p={c.peer} size={38} />
            <span className="cbWho"><b>{c.peer.name}</b><small>{c.peer.sub}</small></span>
            <span className="cbContact">{c.peer.phone && <a href={`tel:${c.peer.phone.replace(/\s/g, "")}`}>{c.peer.phone}</a>}{c.peer.email && <a href={`mailto:${c.peer.email}`}>{c.peer.email}</a>}</span>
          </div>
          <div className="cbThreadPost">
            <KindTag k={c.post.kind} />
            <span className="cbWho"><b>{c.post.title}</b><small>{where(c.post)}{c.post.due ? ` · termen ${dayMonth(c.post.due)}` : ""}{c.role === "author" ? " · anunțul tău" : ""}</small></span>
            {c.role === "author" && !c.state && c.post.status === "active" && <button type="button" className="btn btnGold btnSm" onClick={pick}>Alege pentru lucrare</button>}
            {stLabel && <span className={`cbSt ${c.state === "ales" ? "ok" : ""}`}>{stLabel}</span>}
          </div>
          <div className="cbMsgs" ref={box}>
            {msgs.map((m) => m.sys
              ? <div key={m.id} className="cbSys">{m.body}</div>
              : <div key={m.id} className={`cbMsg${m.me ? " me" : ""}`}><span>{m.body}</span><small>{hhmm(m.at)}</small></div>)}
          </div>
          <form className="cbSend" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input className="input" aria-label="Mesaj" value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} placeholder={`Scrie-i un mesaj lui ${c.peer.name.split(" ")[0]}…`} />
            <button type="submit" className="btn btnNavy btnSm" disabled={busy || !draft.trim()}>Trimite</button>
          </form>
        </div>
      ) : <div className="cbThread cbThreadEmpty"><span className="cbMuted">Alege o conversație.</span></div>}
    </div>
  );
}

/* ---------- coverage zone ---------- */

function useZoneForm(s: State) {
  const z = s.profile;
  return useState(() => ({
    available: z?.available !== 0, address: z?.address ?? "", city: z?.city ?? "", county: z?.county ?? s.me.county ?? "Timiș",
    zone_mode: (z?.zone_mode ?? "raza") as "raza" | "judet", radius: z?.radius ?? 50, extra: z?.extra ?? [], kinds: z?.kinds ?? (["inspectie", "raport"] as Kind[]),
  }));
}

function Zones({ s, onSaved, toFeed }: { s: State; onSaved: (m: string) => Promise<void>; toFeed: () => void }) {
  const [f, setF] = useZoneForm(s);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    const r = await call({ action: "profile", ...f });
    setBusy(false);
    if (r.error) return setError(r.error);
    await onSaved(r.located ? "Zonele au fost salvate." : "Zonele au fost salvate, dar nu am putut localiza adresa: distanțele nu se calculează. Verifică localitatea.");
  };
  return (
    <div className="cbPage">
      <div className="cbZoneGrid">
        <div className="cbCol">
          <section className="cbCard cbRow">
            <span className="cbCardText"><b>Disponibil pentru colaborări</b><small>Zonele stabilesc ce vezi implicit în „Lucrări ocazionale” și din ce zone primești notificări (doar în aplicație). Oprit = nu primești notificări, dar vezi în continuare toate anunțurile.</small></span>
            <Switch on={f.available} label="Disponibil pentru colaborări" onChange={(v) => setF({ ...f, available: v })} />
          </section>
          <section className="cbCard">
            <small className="cbStep">1 · LOCAȚIE DE BAZĂ</small><b className="cbCardTitle">De aici se calculează distanțele</b>
            <div className="cbGrid3">
              <label className="field">Adresă <small>(opțional)</small><input className="input" value={f.address} maxLength={160} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="ex. Str. Paris 12" /></label>
              <label className="field">Localitate<input className="input" value={f.city} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="ex. Timișoara" /></label>
              <label className="field">Județ<select className="select" value={f.county} onChange={(e) => setF({ ...f, county: e.target.value, extra: f.extra.filter((x) => x !== e.target.value) })}>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <div className="cbSeg">
              <button type="button" aria-pressed={f.zone_mode === "raza"} onClick={() => setF({ ...f, zone_mode: "raza" })}>Rază în jurul adresei</button>
              <button type="button" aria-pressed={f.zone_mode === "judet"} onClick={() => setF({ ...f, zone_mode: "judet" })}>Tot județul {f.county}</button>
            </div>
            {f.zone_mode === "raza" && <Radius value={f.radius} onChange={(v) => setF({ ...f, radius: v })} />}
          </section>
          <section className="cbCard">
            <small className="cbStep">2 · JUDEȚE SUPLIMENTARE</small><b className="cbCardTitle">Alte județe în care accepți lucrări</b>
            <small className="cbMuted">Pentru fiecare județ adăugat se iau în calcul toate anunțurile din județ.</small>
            <ExtraCounties home={f.county} value={f.extra} onChange={(extra) => setF({ ...f, extra })} />
          </section>
          <section className="cbCard">
            <small className="cbStep">3 · TIPURI DE LUCRĂRI</small><b className="cbCardTitle">Ce fel de solicitări vrei să primești</b>
            {([["inspectie", "Colegul are nevoie doar de vizita la proprietate"], ["raport", "Preiei dosarul complet: vizita și raportul"]] as [Kind, string][]).map(([k, sub]) => (
              <label key={k} className="cbKind"><input type="checkbox" checked={f.kinds.includes(k)} onChange={(e) => setF({ ...f, kinds: e.target.checked ? [...f.kinds, k] : f.kinds.filter((x) => x !== k) })} /><span><b>{KINDS[k]}</b><small>{sub}</small></span></label>
            ))}
          </section>
        </div>
        <aside className="cbSide">
          <div className="cbBox">
            <small className="cbLabel">ZONE ACTIVE</small>
            {!f.available ? <span className="cbMuted">Nu primești notificări.</span> : (
              <>
                <div className="cbSum"><b>{f.county}{f.city ? ` (bază: ${f.city})` : ""}</b><span>{f.zone_mode === "judet" ? "Tot județul" : `Rază ${f.radius} km`}</span></div>
                {f.extra.map((j) => <div key={j} className="cbSum"><b>{j}</b><span>Tot județul</span></div>)}
              </>
            )}
          </div>
          {error && <div role="alert" className="error">{error}</div>}
          <div className="cbBox dark">
            <b>{s.feed.filter((p) => p.inZone && !p.own).length} lucrări active în zonele tale</b>
            <span>Salvează ca să vezi lucrările după noile zone.</span>
            <div className="cbActs"><button type="button" className="btn btnGold btnSm" disabled={busy} onClick={save}>{busy ? "Se salvează…" : "Salvează"}</button><button type="button" className="linkBtn onDark" onClick={toFeed}>Vezi lucrările →</button></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="cbSwitch" onClick={() => onChange(!on)}><i /></button>;
}
function Radius({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="cbRadius">
      <div><span>Rază acoperită</span><b>{value} km</b></div>
      <input type="range" min={10} max={150} step={5} value={value} aria-label="Raza în kilometri" onChange={(e) => onChange(Number(e.target.value))} />
      <div className="cbMuted"><span>10 km</span><span>150 km</span></div>
    </div>
  );
}
function ExtraCounties({ home, value, onChange }: { home: string; value: string[]; onChange: (v: string[]) => void }) {
  const opts = COUNTIES.filter((j) => j !== home && !value.includes(j));
  return (
    <div className="cbChips">
      {value.map((j) => <span key={j} className="cbPick">{j}<button type="button" aria-label={`Scoate județul ${j}`} onClick={() => onChange(value.filter((x) => x !== j))}>×</button></span>)}
      {value.length === 0 && <span className="cbMuted">Niciun județ suplimentar.</span>}
      <label className="cbAdd">+<select value="" aria-label="Adaugă județ" onChange={(e) => e.target.value && onChange([...value, e.target.value])}><option value="">Adaugă județ</option>{opts.map((j) => <option key={j}>{j}</option>)}</select></label>
    </div>
  );
}

/* ---------- profile ---------- */

function Specs({ s }: { s: State }) {
  return (
    <div className="field">Specializări
      <div className="cbChips">
        {s.me.specs.length ? s.me.specs.map((x) => <span key={x} className="cbPick dark">{x}</span>) : <span className="cbMuted">—</span>}
        <small className="cbMuted">preluate din Tabloul ANEVAR · nu se modifică aici</small>
      </div>
    </div>
  );
}

function Skills({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [d, setD] = useState("");
  const add = (t: string) => { t = t.trim(); if (t && !value.includes(t)) onChange([...value, t]); setD(""); };
  const sugg = SKILL_SUGGESTIONS.filter((x) => !value.includes(x)).slice(0, 5);
  return (
    <div className="field">Competențe
      <div className="cbChips">{value.map((k) => <span key={k} className="cbPick dark">{k}<button type="button" aria-label={`Elimină ${k}`} onClick={() => onChange(value.filter((x) => x !== k))}>×</button></span>)}</div>
      <div className="cbInline">
        <input className="input" value={d} maxLength={60} onChange={(e) => setD(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(d); } }} placeholder="Scrie o competență și apasă Enter" aria-label="Competență nouă" />
        <button type="button" className="btn btnGhost btnSm" onClick={() => add(d)}>+ Adaugă competență</button>
      </div>
      {sugg.length > 0 && <div className="cbChips"><small className="cbMuted">Sugestii:</small>{sugg.map((x) => <button key={x} type="button" className="cbSugg" onClick={() => add(x)}>+ {x}</button>)}</div>}
    </div>
  );
}

function ProfileModal({ s, onClose, onSaved }: { s: State; onClose: () => void; onSaved: () => void }) {
  const z = s.profile!;
  const [f, setF] = useState({ years: z.years ?? "", skills: z.skills, experience: z.experience.length ? z.experience : [{ firm: "", role: "", period: "" }], about: z.about ?? "", driving: !!z.driving, travel: !!z.travel });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const save = async () => {
    setBusy(true); setError("");
    const r = await call({ action: "profile", ...f });
    setBusy(false);
    if (r.error) return setError(r.error);
    onSaved();
  };
  const exp = (i: number, k: "firm" | "role" | "period", v: string) => setF({ ...f, experience: f.experience.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });
  return (
    <div className="cbModal" role="dialog" aria-modal="true" aria-labelledby="cbProfT" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cbModalBox">
        <div className="cbModalHead"><Av p={s.me} size={40} /><span className="cbWho"><b id="cbProfT">Profilul meu de evaluator</b><small>Îl văd autorii anunțurilor la care ceri detalii</small></span><button type="button" className="cbX" aria-label="Închide" onClick={onClose}>×</button></div>
        <div className="cbModalBody">
          <div className="cbGrid3">
            <div className="field">Nume<span className="cbRO">{s.me.name}</span></div>
            <div className="field">Legitimație ANEVAR<span className="cbRO">{s.me.anevar ? `${s.me.anevar} · titular` : "—"}</span></div>
            <label className="field">Experiență în evaluare<select className="select" value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })}><option value="">Alege…</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></label>
          </div>
          <Specs s={s} />
          <div className="field">Experiență profesională
            {f.experience.map((e, i) => (
              <div key={i} className="cbExp">
                <input className="input" aria-label="Firmă" placeholder="Firmă" value={e.firm} maxLength={100} onChange={(x) => exp(i, "firm", x.target.value)} />
                <input className="input" aria-label="Rol" placeholder="Rol" value={e.role} maxLength={100} onChange={(x) => exp(i, "role", x.target.value)} />
                <input className="input" aria-label="Perioadă" placeholder="2019 – prezent" value={e.period} maxLength={40} onChange={(x) => exp(i, "period", x.target.value)} />
                <button type="button" className="cbX" aria-label="Șterge experiența" onClick={() => setF({ ...f, experience: f.experience.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="linkBtn" style={{ alignSelf: "flex-start" }} onClick={() => setF({ ...f, experience: [...f.experience, { firm: "", role: "", period: "" }] })}>+ Adaugă experiență</button>
          </div>
          <Skills value={f.skills} onChange={(skills) => setF({ ...f, skills })} />
          <div className="cbGrid2">
            <div className="cbCard cbRow small"><b>Permis categoria B</b><Switch on={f.driving} label="Permis categoria B" onChange={(v) => setF({ ...f, driving: v })} /></div>
            <div className="cbCard cbRow small"><b>Disponibil pentru deplasări</b><Switch on={f.travel} label="Disponibil pentru deplasări" onChange={(v) => setF({ ...f, travel: v })} /></div>
          </div>
          <label className="field">Despre tine <small>(opțional)</small><textarea className="textarea" rows={3} maxLength={1200} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} placeholder="Tipuri de lucrări, bănci cu care lucrezi, zone…" /></label>
        </div>
        <div className="cbModalFoot">
          <span className={error ? "error" : "cbMuted"}>{error || "Profilul se salvează în contul tău și îl folosești la toate cererile."}</span>
          <button type="button" className="linkBtn" onClick={onClose}>Anulează</button>
          <button type="button" className="btn btnNavy btnSm" disabled={busy} onClick={save}>{busy ? "Se salvează…" : "Salvează profilul"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- activation ---------- */

function Setup({ s, onDone }: { s: State; onDone: (m: string) => Promise<void> }) {
  const [f, setF] = useZoneForm(s);
  const [years, setYears] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finish = async () => {
    if (f.available && !f.city.trim()) return setError("Scrie localitatea de bază, ca să-ți calculăm zona.");
    setBusy(true); setError("");
    const r = await call({ action: "profile", ...f, years });
    setBusy(false);
    if (r.error) return setError(r.error);
    await onDone(f.available ? "Colaborările sunt active. Primești notificări pentru lucrările din zona ta." : "Colaborările sunt active, fără notificări. Îți poți seta zona din „Zone de acoperire”.");
  };
  return (
    <div className="cbSetup">
      <div className="cbSetupHead"><small className="cbStep">ACTIVARE MODUL</small><h2>Bun venit la Colaborări</h2>
        <p>Anunțurile le văd doar evaluatorii înregistrați în UVALO. Înainte de prima folosire, spune-ne dacă vrei să colaborezi, completează-ți profilul și alege zona din care primești solicitări. Le poți schimba oricând.</p></div>
      <section className="cbCard">
        <small className="cbStep">1 · DISPONIBILITATE</small><b className="cbCardTitle">Vrei să preiei lucrări de la colegi?</b>
        {([[true, "Da, sunt disponibil pentru colaborări", "Primesc în aplicație notificări pentru lucrările din zona mea."], [false, "Deocamdată doar mă uit", "Văd toate anunțurile, dar nu primesc notificări. Îmi pot seta zona oricând."]] as const).map(([v, l, sub]) => (
          <label key={String(v)} className="cbOpt"><input type="radio" name="avail" checked={f.available === v} onChange={() => setF({ ...f, available: v })} /><span><b>{l}</b><small>{sub}</small></span></label>
        ))}
      </section>
      <section className="cbCard">
        <small className="cbStep">2 · PROFIL</small><b className="cbCardTitle">Ce văd colegii când ceri detalii la un anunț</b>
        <div className="cbGrid3">
          <div className="field">Evaluator<span className="cbRO">{s.me.name}{s.me.anevar ? ` · ANEVAR ${s.me.anevar}` : ""}</span></div>
          <label className="field">Experiență în evaluare<select className="select" value={years} onChange={(e) => setYears(e.target.value)}><option value="">Alege…</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></label>
        </div>
        <Specs s={s} />
        <small className="cbMuted">Experiența profesională, competențele și celelalte detalii le completezi după activare, din „Profilul meu”.</small>
      </section>
      <section className="cbCard">
        <small className="cbStep">3 · ZONA</small><b className="cbCardTitle">De unde primești solicitări</b>
        {f.available ? (
          <>
            <div className="cbGrid3">
              <label className="field">Adresă de bază <small>(opțional)</small><input className="input" value={f.address} maxLength={160} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="ex. Str. Paris 12" /></label>
              <label className="field">Localitate<input className="input" value={f.city} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="ex. Timișoara" /></label>
              <label className="field">Județ<select className="select" value={f.county} onChange={(e) => setF({ ...f, county: e.target.value })}>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <Radius value={f.radius} onChange={(v) => setF({ ...f, radius: v })} />
            <small className="cbMuted">Tot județul, alte județe și tipurile de lucrări le alegi din „Zone de acoperire”.</small>
          </>
        ) : <p className="cbNote">Fără zonă nu primești notificări. Vezi în continuare toate anunțurile și îți poți seta zona oricând din „Zone de acoperire”.</p>}
      </section>
      <div className="cbSetupFoot">
        <span className={error ? "error" : ""}>{error || (f.available ? "Notificările vin doar în aplicație, pentru zona aleasă. Setările le schimbi oricând." : "Nu primești notificări până nu îți setezi zona.")}</span>
        <button type="button" className="btn btnGold" disabled={busy} onClick={finish}>{busy ? "Se activează…" : "Activează Colaborările"}</button>
      </div>
    </div>
  );
}

/* ---------- "Nou în UVALO" ---------- */

const SPLASH_KEY = "uvalo-colaborari-splash";

/** The announcement shown once (per browser) to the people who can use Colaborări and have not activated it yet. */
export function CollabSplash({ here = false }: { here?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(SPLASH_KEY)) setOpen(true); } catch { setOpen(true); }
  }, []);
  const close = useCallback(() => { try { localStorage.setItem(SPLASH_KEY, new Date().toISOString()); } catch {} setOpen(false); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, close]);
  const art = useMemo(() => <SplashArt />, []);
  if (!open) return null;
  return (
    <div className="cbModal cbSplash" role="dialog" aria-modal="true" aria-labelledby="cbSplashT" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="cbModalBox">
        <div className="cbSplashArt">
          {art}
          <span className="cbSplashTag">NOU ÎN UVALO</span>
          <button type="button" className="cbSplashX" aria-label="Închide" onClick={close}>×</button>
        </div>
        <div className="cbSplashBody">
          <h2 id="cbSplashT">Colaborări între evaluatori</h2>
          <p>Găsește un coleg pentru inspecții și rapoarte acolo unde nu ajungi, sau preia lucrări din zona ta. Anunțurile le văd doar evaluatorii înregistrați în UVALO.</p>
          <div className="cbSplashFeats">
            <span><b>Lucrări din zona ta</b><small>Alegi raza și județele, primești notificări în aplicație.</small></span>
            <span><b>Profil verificat</b><small>Specializările vin direct din Tabloul ANEVAR.</small></span>
            <span><b>Discuți în aplicație</b><small>Datele de contact apar doar după ce începe conversația.</small></span>
          </div>
          <div className="cbSplashActs">
            <button type="button" className="btn btnGhost" onClick={close}>Mai târziu</button>
            {here ? <button type="button" className="btn btnGold" onClick={close}>Activează Colaborările</button>
              : <a className="btn btnGold" href="/colaborari" onClick={() => { try { localStorage.setItem(SPLASH_KEY, new Date().toISOString()); } catch {} }}>Activează Colaborările</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SplashArt() {
  return (
    <svg className="cbSplashSvg" viewBox="0 0 780 320" role="img" aria-label="Un anunț de inspecție în zona de acoperire, cu o conversație între doi evaluatori" preserveAspectRatio="xMidYMid slice">
      <rect width="780" height="320" fill="#141414" />
      <circle cx="150" cy="210" r="210" fill="none" stroke="#e0ad4f" strokeOpacity=".18" />
      <circle cx="150" cy="210" r="130" fill="#e0ad4f" fillOpacity=".06" stroke="#e0ad4f" strokeOpacity=".3" />
      <circle cx="150" cy="210" r="56" fill="#e0ad4f" fillOpacity=".16" stroke="#e0ad4f" strokeWidth="2" />
      <circle cx="150" cy="210" r="8" fill="#fff" stroke="#e0ad4f" strokeWidth="4" />
      <circle cx="248" cy="150" r="5" fill="#e0ad4f" /><circle cx="70" cy="140" r="5" fill="#e0ad4f" /><circle cx="250" cy="280" r="5" fill="#8d857a" />
      <g transform="translate(330 64) rotate(-4)" opacity=".85">
        <rect width="270" height="96" rx="14" fill="#2a2a2a" />
        <rect x="16" y="16" width="130" height="20" rx="10" fill="#f6dcc8" />
        <text x="81" y="30" textAnchor="middle" fontFamily="Verdana, sans-serif" fontSize="9" fontWeight="700" fill="#8a3a12">RAPORT + INSPECȚIE</text>
        <text x="16" y="60" fontFamily="Verdana, sans-serif" fontSize="14" fontWeight="700" fill="#fff">Casă P+M cu teren 900 mp</text>
        <text x="16" y="80" fontFamily="Verdana, sans-serif" fontSize="11" fill="#a79e92">Caransebeș, Caraș-Severin</text>
      </g>
      <g transform="translate(420 100)">
        <rect width="320" height="150" rx="14" fill="#fff" />
        <circle cx="34" cy="32" r="16" fill="#1a1714" />
        <text x="34" y="36" textAnchor="middle" fontFamily="Verdana, sans-serif" fontSize="10" fontWeight="700" fill="#e0ad4f">IM</text>
        <text x="58" y="29" fontFamily="Verdana, sans-serif" fontSize="12" fontWeight="700" fill="#1a1714">Ioana Mureșan</text>
        <text x="58" y="44" fontFamily="Verdana, sans-serif" fontSize="10" fill="#8d857a">EPI · acum 2 ore</text>
        <rect x="226" y="20" width="80" height="20" rx="10" fill="#fbebd0" />
        <text x="266" y="34" textAnchor="middle" fontFamily="Verdana, sans-serif" fontSize="9" fontWeight="700" fill="#8a5a00">INSPECȚIE</text>
        <text x="18" y="76" fontFamily="Verdana, sans-serif" fontSize="15" fontWeight="700" fill="#1a1714">Apartament 3 camere, bloc 1985</text>
        <rect x="18" y="90" width="100" height="22" rx="7" fill="#141414" />
        <text x="28" y="105" fontFamily="Verdana, sans-serif" fontSize="11" fontWeight="700" fill="#fff">Arad <tspan fill="#e0ad4f">≈ 62 km</tspan></text>
        <rect x="126" y="90" width="112" height="22" rx="7" fill="#fff" stroke="#efe4d3" />
        <text x="136" y="105" fontFamily="Verdana, sans-serif" fontSize="11" fill="#4a423a">Buget: <tspan fontWeight="700">250 lei</tspan></text>
        <rect x="204" y="120" width="100" height="22" rx="8" fill="#f2a93b" />
        <text x="254" y="135" textAnchor="middle" fontFamily="Verdana, sans-serif" fontSize="11" fontWeight="700" fill="#1a1714">Vreau detalii</text>
      </g>
      <g transform="translate(300 250)">
        <rect width="200" height="28" rx="14" fill="#f4ece1" />
        <text x="14" y="18" fontFamily="Verdana, sans-serif" fontSize="12" fill="#1a1714">Pot merge joi la 10. Ai CF-ul?</text>
        <rect x="70" y="36" width="160" height="28" rx="14" fill="#e0ad4f" />
        <text x="84" y="54" fontFamily="Verdana, sans-serif" fontSize="12" fontWeight="700" fill="#141414">Da, ți-l trimit acum.</text>
      </g>
    </svg>
  );
}
