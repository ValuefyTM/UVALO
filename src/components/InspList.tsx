"use client";

// Inspecții (canvas „UVALO — Inspecții: listă + hartă și detaliu”): the page opens in Listă + hartă, with a divider you drag between
// the list and the map (25–75 %, double-click = 45/55, dragged to an edge = only the list / only the map), remembered in localStorage.
// One filter row: the tabs (whose), the states with counts, the search, the four views as icons. Compact rows: the pin's number, the
// state, the address, the type · contact, the inspector, the day + time. A row pointed at lights its pin; a pin opens its card on the map.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserAv } from "./UserAv";
import { InspDelete } from "./InspDelete";
import { fmtWhen, fold, STATUS, STATUSES, type InspRow, type Status } from "@/lib/insp-shared";

type Row = InspRow & { who: "mine" | "forme" | "forothers" | "firm" };
type View = "list" | "split" | "map" | "cal";
type Tab = "all" | "mine" | "forothers" | "firm";
// "Ale mele" = my work, whoever does it (also the ones colleagues / collaborators do for me); "Toate" = everything in the list
const WHO: readonly (readonly [Tab, string])[] = [["all", "Toate"], ["mine", "Ale mele"], ["forothers", "Pentru colegi"], ["firm", "Ale firmei"]];
const ico = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const VIEWS: [View, string, React.ReactNode][] = [
  ["split", "Listă + hartă", ico(<><rect x="3" y="4" width="8" height="16" rx="1.5" /><rect x="13" y="4" width="8" height="16" rx="1.5" /><path d="M5.5 9h3M5.5 12h3M5.5 15h3" /></>)],
  ["list", "Listă", ico(<path d="M4 7h16M4 12h16M4 17h16" />)],
  ["map", "Hartă", ico(<><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z" /><circle cx="12" cy="11" r="2.2" /></>)],
  ["cal", "Calendar", ico(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>)],
];
const DAYS = ["LUN", "MAR", "MIE", "JOI", "VIN", "SÂM", "DUM"];
const H0 = 7, H1 = 20, HH = 48; // calendar: 07–20 by default (widened to the week's inspections), 48 px per hour
// text that goes into Leaflet (tooltips are inserted as HTML): addresses come from colleagues and from AI-read documents
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monday = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const TZ = "Europe/Bucharest";
const WD = ["dum", "lun", "mar", "mie", "joi", "vin", "sâm"];
const MO = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
/** ["15:00", "azi"], ["09:00", "vin 7 nov"]; a finished one: ["ieri", "16:20"]; null = no date */
function when(r: Row): [string, string] | null {
  const done = r.status === "gata" || r.status === "pred";
  const at = done ? r.finished_at : r.scheduled_at;
  if (!at) return null;
  const d = new Date(done ? at : `${at.slice(0, 16)}:00`);
  const day = done ? d.toLocaleDateString("en-CA", { timeZone: TZ }) : at.slice(0, 10);
  const time = done ? d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : at.slice(11, 16) || "—";
  const off = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  const dd = new Date(`${day}T12:00:00Z`);
  const date = day === off(0) ? "azi" : day === off(1) ? "mâine" : day === off(-1) ? "ieri" : `${WD[dd.getUTCDay()]} ${dd.getUTCDate()} ${MO[dd.getUTCMonth()]}`;
  return done ? [date, time] : [time, date];
}

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(j.error || "Nu a mers. Încearcă din nou.");
  return j;
}

function Badge({ s, pending }: { s: Status; pending?: boolean }) {
  return <span className="inBadge" style={{ color: STATUS[s].fg, background: STATUS[s].bg }}>{pending ? "Solicitare" : STATUS[s].label}</span>;
}
const rank = (r: Row) => (r.status === "lucru" ? 0 : r.status === "plan" ? 1 : r.status === "prog" ? 2 : r.status === "gata" ? 3 : 4);
const isDone = (r: Row) => r.status === "gata" || r.status === "pred";

const SPLIT_KEY = "insp-split"; // the list's share of the width (25–75), or "list" / "map" when one side is collapsed
const SPLIT_DEF = 45;

/** Inspecții: the tabs (whose), the states, the search and the views (Listă + hartă with the draggable divider, Listă, Hartă, Calendar). */
export function InspList({ rows: initial, meId, ops, mergeOrg = null, firmOrgs = [] }: { rows: Row[]; meId: string; ops?: boolean; mergeOrg?: string | null; firmOrgs?: string[] }) {
  const [rows, setRows] = useState(initial);
  // the office's administrator IS the firm: "Ale mele" also holds the firm's inspections prepared by colleagues. The operationals get
  // "Ale firmei" (every inspection of the firm) instead of "Ale mele" / "Pentru colegi".
  const inTab = (r: Row, k: Tab) => (k === "all" ? true : k === "firm" ? !!r.org_id && firmOrgs.includes(r.org_id)
    : k === "mine" ? r.who === "mine" || r.who === "forme" || (r.who === "firm" && !!mergeOrg && r.org_id === mergeOrg) : r.who === k);
  const tabs = WHO.filter(([k]) => (k === "firm" ? firmOrgs.length > 0 : !ops));
  const [who, setWho] = useState<Tab>(ops ? "firm" : "all");
  // who prepared it (or its firm's viewers) may delete it; the person who only does it may not
  const canDel = (r: Row) => r.created_by === meId || (!!r.org_id && (firmOrgs.includes(r.org_id) || r.org_id === mergeOrg));
  const [st, setSt] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("split");
  const [msg, setMsg] = useState("");
  const [focus, setFocus] = useState<string | null>(null); // split view: the row / pin pointed at
  useEffect(() => { try { const v = localStorage.getItem("insp-view"); if (v === "map" || v === "cal" || v === "list") setView(v); } catch {} }, []);
  const pick = (v: View) => { setView(v); try { localStorage.setItem("insp-view", v); } catch {} };

  const inWho = rows.filter((r) => inTab(r, who));
  const qf = fold(q.trim());
  // the open ones first (in progress, scheduled by date, to schedule), then the finished ones, newest first
  const shown = useMemo(() => inWho.filter((r) => (st === "all" || r.status === st) && (!qf || fold(`${r.address} ${r.cad_nr ?? ""} ${r.contact_name ?? ""} ${r.code}`).includes(qf)))
    .sort((a, b) => rank(a) - rank(b) || (isDone(a) ? (b.finished_at ?? "").localeCompare(a.finished_at ?? "") : (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, who, st, qf]);
  const filtered = !!qf || st !== "all";
  const clear = () => { setQ(""); setSt("all"); };

  async function schedule(id: string, when: string) {
    setMsg("");
    try {
      await post({ action: "schedule", id, scheduled_at: when });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, scheduled_at: when, status: "plan" } : r)));
    } catch (e) { setMsg((e as Error).message); }
  }

  /* ---------- the divider between the list and the map ---------- */
  const [pct, setPct] = useState<number>(SPLIT_DEF);
  const [fold_, setFold] = useState<"" | "list" | "map">(""); // which side is collapsed
  const [vert, setVert] = useState(false); // phone: the map above the list, the handle drags up / down
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try { const v = localStorage.getItem(SPLIT_KEY); if (v === "list" || v === "map") setFold(v); else if (v && !isNaN(+v)) setPct(Math.min(75, Math.max(25, +v))); } catch {}
    const mq = matchMedia("(max-width: 860px)"); const on = () => setVert(mq.matches); on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const save = (v: string) => { try { localStorage.setItem(SPLIT_KEY, v); } catch {} };
  const drag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = box.current; if (!el) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect();
    let last = pct;
    const move = (ev: PointerEvent) => {
      // on the phone the list is under the map: its share grows as the handle goes up
      const raw = vert ? ((r.bottom - ev.clientY) / r.height) * 100 : ((ev.clientX - r.left) / r.width) * 100;
      if (raw < 12) { setFold("map"); return; }
      if (raw > 88) { setFold("list"); return; }
      setFold(""); last = Math.round(Math.min(75, Math.max(25, raw))); setPct(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setFold((f) => { save(f || String(last)); return f; });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }, [pct, vert]);
  const reset = () => { setFold(""); setPct(SPLIT_DEF); save(String(SPLIT_DEF)); };
  const unfold = () => { setFold(""); save(String(pct)); };
  const one = !vert && pct < 36; // a narrow list: one line per inspection

  const placed = useMemo(() => shown.filter((r) => r.lat != null && r.lng != null), [shown]);
  const onPin = (id: string) => { setFocus(id); document.getElementById(`ic-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };

  const row = (r: Row) => {
    const n = placed.findIndex((p) => p.id === r.id);
    const w = when(r);
    const done = isDone(r);
    const href = r.status === "prog" ? `/inspectii/nou?id=${r.id}` : `/inspectii/${r.id}`;
    return (
      <a key={r.id} id={`ic-${r.id}`} href={href} className={`ixRow${focus === r.id ? " on" : ""}`} onMouseEnter={() => setFocus(r.id)} onMouseLeave={() => setFocus(null)}>
        <span className="ixPin" style={{ background: n >= 0 ? STATUS[r.status].fg : "#BDB3A0" }}>{done ? "✓" : n >= 0 ? n + 1 : "·"}</span>
        <span className="ixTxt">
          <b title={r.address}>{r.address}</b>
          <small>
            <Badge s={r.status} pending={r.assign_state === "pending"} />
            {(r.prop_type || r.contact_name) && <span>{[r.prop_type, done && r.sheet_no ? r.sheet_no : r.contact_name].filter(Boolean).join(" · ")}</span>}
            {r.who === "forothers" ? <span className="ixWho"><UserAv id={r.created_by} name={r.owner_name} has={r.owner_av} size={18} />pentru {r.owner_name.split(" ").slice(0, 2).join(" ")}</span>
              : r.assignee_id && r.assignee_id !== meId ? <span className="ixWho"><UserAv id={r.assignee_id} name={r.assignee_name ?? "?"} has={r.assignee_av} size={18} />{(r.assignee_name ?? "").split(" ").slice(0, 2).join(" ")}</span>
              : r.assignee_kind === "collab" && !r.assignee_id ? <span className="ixWho">coleg din Colaborări · de ales</span> : null}
            {r.assign_state === "pending" && <em>așteaptă acceptarea</em>}
            {r.assign_state === "declined" && <em className="no">refuzată · alege altcineva</em>}
            {r.lat == null && <em className="off">fără poziție pe hartă</em>}
          </small>
        </span>
        {w ? <span className={`ixWhen${done ? " done" : ""}`}><b>{w[0]}</b><small>{w[1]}</small></span>
          : r.status === "prog" ? <span className="ixBtn">Programează</span> : <span className="ixWhen"><small>fără dată</small></span>}
      </a>
    );
  };

  return (
    <div className="inList">
      <div className="ixBar">
        <div className="ixTabs" role="tablist" aria-label="Ale cui">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={who === k} onClick={() => { setWho(k); setSt("all"); }}>{l} <i>{rows.filter((r) => inTab(r, k)).length}</i></button>
          ))}
        </div>
        <div className="ixSt" role="tablist" aria-label="Stare">
          <button type="button" role="tab" aria-selected={st === "all"} onClick={() => setSt("all")} style={{ "--c": "#E0AD4F" } as React.CSSProperties}>Toate <b>{inWho.length}</b></button>
          {STATUSES.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={st === k} onClick={() => setSt(k)} style={{ "--c": STATUS[k].fg } as React.CSSProperties}>
              {k === "plan" ? "Programate" : k === "gata" ? "Finalizate" : k === "pred" ? "Predate" : STATUS[k].label} <b>{inWho.filter((r) => r.status === k).length}</b>
            </button>
          ))}
        </div>
        <label className="ixSearch">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Adresă, nr. cadastral, contact, cod" aria-label="Caută" />
          {q && <><em>{shown.length}</em><button type="button" aria-label="Golește căutarea" onClick={() => setQ("")}>×</button></>}
        </label>
        <div className="ixViews" role="group" aria-label="Vedere">
          {VIEWS.map(([k, l, ic]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => pick(k)} title={l} aria-label={l}>{ic}</button>)}
        </div>
      </div>
      {msg && <p className="note" role="alert">{msg}</p>}
      {rows.length >= 800 && <p className="hint">Se afișează cele mai recente 800 de inspecții; cele mai vechi nu apar în listă.</p>}

      {view === "split" && (shown.length ? (
        <div ref={box} className={`ixSplit${vert ? " vert" : ""}${fold_ ? ` fold-${fold_}` : ""}`}>
          {fold_ === "map" ? (
            <button type="button" className="ixFold" onClick={unfold} title="Arată lista"><span>Arată lista · {shown.length}</span></button>
          ) : (
            <div className={`ixList${one ? " one" : ""}`} style={vert ? { flexBasis: fold_ === "list" ? "auto" : `${pct}%` } : { flexBasis: fold_ === "list" ? "auto" : `${pct}%` }}>
              <div className="ixHead">Ordonate după <b>dată</b> · <b>{shown.length}</b> {shown.length === 1 ? "inspecție" : "inspecții"} · cele de azi primele{placed.length < shown.length && <span> · {shown.length - placed.length} fără poziție</span>}</div>
              <div className="ixRows" aria-label="Inspecții">{shown.map(row)}</div>
            </div>
          )}
          {/* the divider: drag it; double-click = 45 / 55 */}
          <div className="ixDiv" role="separator" aria-orientation={vert ? "horizontal" : "vertical"} aria-label="Lățimea listei" aria-valuenow={fold_ ? (fold_ === "map" ? 0 : 100) : pct} aria-valuemin={0} aria-valuemax={100}
            title="Trage ca să mărești harta sau lista · dublu-click = egal" onPointerDown={drag} onDoubleClick={reset}>
            <span className="ixGrip" aria-hidden="true"><svg viewBox="0 0 10 18" fill="currentColor"><circle cx="2.5" cy="3" r="1.6" /><circle cx="7.5" cy="3" r="1.6" /><circle cx="2.5" cy="9" r="1.6" /><circle cx="7.5" cy="9" r="1.6" /><circle cx="2.5" cy="15" r="1.6" /><circle cx="7.5" cy="15" r="1.6" /></svg></span>
          </div>
          {fold_ === "list" ? (
            <button type="button" className="ixFold" onClick={unfold} title="Arată harta"><span>Arată harta · {placed.length}</span></button>
          ) : (
            <div className="ixMap"><MapView rows={shown} focus={focus} onPin={onPin} bare controls /></div>
          )}
        </div>
      ) : <Empty who={who} filtered={filtered} q={q.trim()} onClear={clear} />)}

      {view === "list" && (shown.length ? (
        <div className="card inTableBox">
          <table className="table inTable">
            <thead><tr><th>Bunul</th><th>Contact</th><th>Programare</th><th>{who === "forothers" ? "Pentru" : "Cine o face"}</th><th>Stare</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><a className="inAddr" href={`/inspectii/${r.id}`}><b>{r.address}</b><small>{[r.prop_type, r.cad_nr && `nr. cad. ${r.cad_nr}`, r.code].filter(Boolean).join(" · ")}</small></a></td>
                  <td>{r.contact_name || "—"}</td>
                  <td className="nowrap">{fmtWhen(r.scheduled_at)}</td>
                  <td>{r.who === "forothers" ? <span className="inPerson"><UserAv id={r.created_by} name={r.owner_name} has={r.owner_av} size={26} />{who === "forothers" ? r.owner_name : `Eu, pentru ${r.owner_name}`}</span>
                    : r.assignee_kind === "collab" && !r.assignee_id ? "Coleg din Colaborări (de ales)"
                    : r.assignee_id ? <span className="inPerson"><UserAv id={r.assignee_id} name={r.assignee_name ?? "?"} has={r.assignee_av} size={26} />{r.assignee_id === meId ? "Eu" : r.assignee_name}
                        {r.assign_state === "pending" && <em className="inAsk">așteaptă acceptarea</em>}</span>
                    : r.assign_state === "declined" ? <em className="inAsk no">Refuzată · alege altcineva</em> : "—"}</td>
                  <td><Badge s={r.status} /></td>
                  <td className="right nowrap"><a className="rowLink" href={r.status === "prog" ? `/inspectii/nou?id=${r.id}` : `/inspectii/${r.id}`}>
                    {r.status === "gata" || r.status === "pred" ? "Vezi fișa →" : r.status === "lucru" ? "Fișa în lucru →" : r.status === "prog" ? "Programează" : "Detalii →"}</a>
                    {canDel(r) && <InspDelete id={r.id} address={r.address} done={r.status === "gata" || r.status === "pred"} icon onDeleted={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty who={who} filtered={filtered} q={q.trim()} onClear={clear} />)}

      {view === "map" && (shown.length ? <div className="ixMapOnly"><MapView rows={shown} onPin={(id) => { location.href = `/inspectii/${id}`; }} bare controls /></div>
        : <Empty who={who} filtered={filtered} q={q.trim()} onClear={clear} />)}
      {view === "cal" && <CalView rows={shown} unplanned={inWho.filter((r) => r.status === "prog")} onSchedule={schedule} />}
    </div>
  );
}

function Empty({ who, filtered, q, onClear }: { who: Tab; filtered?: boolean; q?: string; onClear?: () => void }) {
  if (filtered) return (
    <div className="card inEmpty">
      <b>{q ? `Niciun rezultat pentru „${q}”` : "Nicio inspecție cu starea aleasă"}</b>
      <p className="hint">Verifică textul căutat sau alege altă stare.</p>
      <button type="button" className="btn btnGhost" onClick={onClear}>Arată toate</button>
    </div>
  );
  return (
    <div className="card inEmpty">
      <b>{who === "firm" ? "Firma nu are încă inspecții" : who === "mine" || who === "all" ? "Nicio inspecție încă" : "Nu faci încă inspecții pentru colegi"}</b>
      <p className="hint">{who === "firm" ? "Aici apar toate inspecțiile biroului, indiferent cine le-a pregătit sau cine le face." : who === "mine" || who === "all" ? "Pregătește prima inspecție: bunul, fișa, contactul și programarea. Pe telefon doar o faci." : "Le vei vedea aici când un coleg din birou sau din Colaborări îți trimite o inspecție."}</p>
      {who !== "forothers" && <a className="btn btnGold" href="/inspectii/nou">Inspecție nouă</a>}
    </div>
  );
}

/* ---------- map (Leaflet, map / satellite, the pins with their cards) ---------- */

type LeafletNS = { map: (el: HTMLElement, o?: object) => LMap; tileLayer: (u: string, o?: object) => LLayer; divIcon: (o: object) => unknown;
  marker: (ll: [number, number], o?: object) => LMarker; latLngBounds: (a: [number, number][]) => unknown; layerGroup: () => { addTo: (m: LMap) => LGroup } };
type LLayer = { addTo: (m: LMap) => LLayer; remove: () => void };
type LMarker = { addTo: (m: LMap) => LMarker; bindTooltip: (t: string, o?: object) => LMarker; bindPopup: (h: string, o?: object) => LMarker; openPopup: () => void; on: (e: string, f: () => void) => unknown };
type LMap = { fitBounds: (b: unknown, o?: object) => void; setView: (ll: [number, number], z: number) => void; invalidateSize: () => void; remove: () => void; zoomIn: () => void; zoomOut: () => void; closePopup: () => void };
type LGroup = { clearLayers: () => void };
let leaflet: Promise<LeafletNS> | null = null;
function loadLeaflet() {
  leaflet ??= new Promise((res, rej) => {
    const w = window as unknown as { L?: LeafletNS };
    if (w.L) return res(w.L);
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => res((window as unknown as { L: LeafletNS }).L); s.onerror = rej; document.head.appendChild(s);
  });
  return leaflet;
}
const TILES = {
  map: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }],
  sat: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" }],
} as const;

/** controls = the Hartă / Satelit switch, zoom, „Încadrează toate” and the legend over the map; a pin opens its card (Deschide, Navighează). */
export function MapView({ rows, focus = null, onPin, bare = false, controls = false }: { rows: Row[]; focus?: string | null; onPin?: (id: string) => void; bare?: boolean; controls?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const placed = useMemo(() => rows.filter((r) => r.lat != null && r.lng != null), [rows]);
  const [base, setBase] = useState<"map" | "sat">("map");
  const map = useRef<LMap | null>(null);
  const layer = useRef<LLayer | null>(null);
  const Lref = useRef<LeafletNS | null>(null);
  useEffect(() => { try { if (localStorage.getItem("insp-base") === "sat") setBase("sat"); } catch {} }, []);
  // split view: the pin of the row pointed at is highlighted
  useEffect(() => {
    el.current?.querySelectorAll<HTMLElement>(".inPin").forEach((p) => p.classList.toggle("on", p.dataset.id === focus));
  }, [focus]);
  const pinRef = useRef(onPin); pinRef.current = onPin;
  // the parent re-renders on every hover (new arrays): the map is rebuilt only when the pins themselves change
  const pinsKey = placed.map((r) => `${r.id}:${r.lat}:${r.lng}:${r.status}:${r.address}`).join("|");
  const placedRef = useRef(placed); placedRef.current = placed;
  const fit = () => { const m = map.current, L = Lref.current, p = placedRef.current; if (!m || !L) return; if (p.length) m.fitBounds(L.latLngBounds(p.map((r) => [r.lat!, r.lng!])), { padding: [40, 40], maxZoom: 15 }); else m.setView([45.75, 21.23], 9); };
  useEffect(() => {
    const placed = placedRef.current;
    let m: LMap | null = null, gone = false;
    loadLeaflet().then((L) => {
      if (gone || !el.current) return;
      Lref.current = L;
      m = L.map(el.current, { scrollWheelZoom: false, zoomControl: !controls });
      map.current = m;
      layer.current = L.tileLayer(TILES[base][0], TILES[base][1]).addTo(m);
      placed.forEach((r, i) => {
        const done = r.status === "gata" || r.status === "pred";
        const icon = L.divIcon({ className: "", html: `<span class="inPin" data-id="${r.id}" style="background:${STATUS[r.status].fg}">${done ? "✓" : i + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 28] });
        const mk = L.marker([r.lat!, r.lng!], { icon }).addTo(m!);
        const w = when(r);
        const href = r.status === "prog" ? `/inspectii/nou?id=${r.id}` : `/inspectii/${r.id}`;
        mk.bindPopup(`<div class="ixPop"><b>${esc(r.address)}</b><small>${esc([r.assign_state === "pending" ? "Solicitare" : STATUS[r.status].label, w ? `${w[0]} ${w[1]}` : "fără dată", r.prop_type ?? "", r.assignee_name ?? ""].filter(Boolean).join(" · "))}</small>` +
          `<span class="ixPopActs"><a class="ixBtn dark" href="${href}">Deschide</a><a class="ixBtn" href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" rel="noopener">Navighează</a></span></div>`, { closeButton: true, offset: [0, -24], maxWidth: 300 });
        mk.on("click", () => { if (pinRef.current) pinRef.current(r.id); });
      });
      if (placed.length) m.fitBounds(L.latLngBounds(placed.map((r) => [r.lat!, r.lng!])), { padding: [40, 40], maxZoom: 15 });
      else m.setView([45.75, 21.23], 9);
    }).catch(() => {});
    return () => { gone = true; m?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);
  // the base layer (map / satellite) is swapped without rebuilding the pins
  useEffect(() => {
    const m = map.current, L = Lref.current; if (!m || !L) return;
    layer.current?.remove(); layer.current = L.tileLayer(TILES[base][0], TILES[base][1]).addTo(m);
  }, [base]);
  const pickBase = (b: "map" | "sat") => { setBase(b); try { localStorage.setItem("insp-base", b); } catch {} };
  const mapEl = <div ref={el} className={bare ? "inMap inSplitMap" : "inMap"} role="region" aria-label="Harta inspecțiilor" />;
  const over = controls && (
    <>
      <div className="ixLayer" role="group" aria-label="Strat"><button type="button" aria-pressed={base === "map"} onClick={() => pickBase("map")}>Hartă</button><button type="button" aria-pressed={base === "sat"} onClick={() => pickBase("sat")}>Satelit</button></div>
      <div className="ixCtl"><button type="button" aria-label="Mărește" onClick={() => map.current?.zoomIn()}>+</button><button type="button" aria-label="Micșorează" onClick={() => map.current?.zoomOut()}>−</button></div>
      <span className="hdLegend" aria-hidden="true">{(["lucru", "plan", "prog", "gata"] as const).map((s) => <span key={s}><i style={{ background: STATUS[s].fg }} />{STATUS[s].label}</span>)}</span>
      <button type="button" className="ixBtn ixFit" onClick={fit}>Încadrează toate</button>
    </>
  );
  if (bare) return controls ? <div className="ixMapBox">{mapEl}{over}</div> : mapEl;
  return (
    <div className="inMapWrap">
      {mapEl}
      <div className="inMapList">
        {placed.map((r, i) => (
          <a key={r.id} href={`/inspectii/${r.id}`} className="inMapItem"><b className="inNum">{i + 1}</b><span><b>{r.address}</b><small>{fmtWhen(r.scheduled_at)} · {STATUS[r.status].label}</small></span></a>
        ))}
        {rows.length > placed.length && <p className="hint">{rows.length - placed.length} fără poziție pe hartă (adresa nu a fost găsită).</p>}
        {!rows.length && <p className="hint">Nicio inspecție în filtrul ales.</p>}
      </div>
    </div>
  );
}

/* ---------- calendar (week), with "De programat" dragged onto an hour ---------- */

export function CalView({ rows, unplanned, onSchedule }: { rows: Row[]; unplanned: Row[]; onSchedule: (id: string, when: string) => void }) {
  const [start, setStart] = useState(() => monday(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const today = ymd(new Date());
  const end = days[6];
  const title = start.getMonth() === end.getMonth() ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  const move = (w: number) => setStart((s) => { const d = new Date(s); d.setDate(d.getDate() + 7 * w); return d; });
  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
  // hour range: 07–20, widened so an inspection at 06:00 or 20:30 is not drawn off the grid
  const inWeek = rows.filter((r) => r.scheduled_at && days.some((d) => r.scheduled_at!.startsWith(ymd(d))));
  const hOf = (r: Row) => { const [a, b] = r.scheduled_at!.slice(11, 16).split(":").map(Number); return a + b / 60; };
  const h0 = Math.min(H0, ...inWeek.map((r) => Math.floor(hOf(r))));
  const h1 = Math.max(H1, ...inWeek.map((r) => Math.min(24, Math.ceil(hOf(r) + (r.duration_min || 60) / 60))));
  const drop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/insp");
    if (!id) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const h = Math.max(h0, Math.min(h1 - 1, h0 + Math.floor((y / HH) * 2) / 2));
    onSchedule(id, `${ymd(day)}T${pad(Math.floor(h))}:${h % 1 ? "30" : "00"}`);
  };
  return (
    <div className="inCalWrap">
      <div className="card inCal">
        <div className="inCalHead">
          <button type="button" className="btn btnGhost btnSm" aria-label="Săptămâna anterioară" onClick={() => move(-1)}>‹</button>
          <button type="button" className="btn btnGhost btnSm" aria-label="Săptămâna următoare" onClick={() => move(1)}>›</button>
          <b>{title}</b>
          <button type="button" className="btn btnGhost btnSm" onClick={() => setStart(monday(new Date()))}>Azi</button>
        </div>
        <div className="inCalScroll">
          <div className="inCalGrid">
            <span />
            {days.map((d, i) => <span key={i} className={`inCalDay${ymd(d) === today ? " today" : ""}${i > 4 ? " wk" : ""}`}><small>{DAYS[i]}</small><b>{d.getDate()}</b></span>)}
            <div className="inCalHours">{Array.from({ length: h1 - h0 }, (_, i) => <span key={i} style={{ height: HH }}>{pad(h0 + i)}</span>)}</div>
            {days.map((d, i) => {
              const key = ymd(d);
              const evs = lanes(rows.filter((r) => r.scheduled_at?.startsWith(key)), hOf);
              return (
                <div key={i} className={`inCalCol${key === today ? " today" : ""}${i > 4 ? " wk" : ""}`} style={{ height: (h1 - h0) * HH }}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, d)}>
                  {evs.map(({ r, lane, of }) => {
                    const top = Math.max(0, (hOf(r) - h0) * HH), h = Math.max(24, ((r.duration_min || 60) / 60) * HH - 4);
                    return (
                      <a key={r.id} href={`/inspectii/${r.status === "prog" || r.status === "plan" ? `nou?id=${r.id}` : r.id}`} className={`inEv${h < 40 ? " short" : ""}`}
                        title={`${r.scheduled_at!.slice(11, 16)} · ${r.address} · ${STATUS[r.status].label}`}
                        style={{ top: top + 2, height: h, color: STATUS[r.status].fg, background: STATUS[r.status].bg,
                          ...(of > 1 ? { left: `calc(${(lane / of) * 100}% + 2px)`, right: "auto", width: `calc(${100 / of}% - 4px)` } : {}) }}>
                        <b>{r.scheduled_at!.slice(11, 16)} · {r.address.split(",")[0]}</b><small>{STATUS[r.status].label}</small>
                      </a>
                    );
                  })}
                  {key === today && nowH > h0 && nowH < h1 && <span className="inNow" style={{ top: (nowH - h0) * HH }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <aside className="inUnplanned">
        <b>De programat</b>
        <p className="hint">Trage o inspecție pe o oră din calendar ca s-o programezi.</p>
        {unplanned.map((r) => (
          <div key={r.id} className="inDrag" draggable onDragStart={(e) => e.dataTransfer.setData("text/insp", r.id)}>
            <span aria-hidden="true">⠿</span><span><b>{r.address}</b><small>{r.prop_type ?? ""}</small></span>
          </div>
        ))}
        {!unplanned.length && <p className="hint">Nimic de programat.</p>}
      </aside>
    </div>
  );
}

/** Inspections of one day that overlap are placed side by side: each gets its lane and the number of lanes of its group. */
function lanes(rs: Row[], hOf: (r: Row) => number) {
  const sorted = [...rs].sort((a, b) => hOf(a) - hOf(b));
  const out: { r: Row; lane: number; of: number }[] = [];
  let group: { r: Row; lane: number; of: number }[] = [], ends: number[] = [], groupEnd = -1;
  const flush = () => { group.forEach((g) => (g.of = ends.length)); out.push(...group); group = []; ends = []; };
  for (const r of sorted) {
    const a = hOf(r), b = a + (r.duration_min || 60) / 60;
    if (group.length && a >= groupEnd) flush();
    let lane = ends.findIndex((e) => e <= a);
    if (lane < 0) { lane = ends.length; ends.push(b); } else ends[lane] = b;
    group.push({ r, lane, of: 1 });
    groupEnd = Math.max(groupEnd, b);
  }
  flush();
  return out;
}
