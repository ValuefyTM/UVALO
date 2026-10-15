"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserAv } from "./UserAv";
import { fmtWhen, STATUS, STATUSES, type InspRow, type Status } from "@/lib/insp-shared";

type Row = InspRow & { who: "mine" | "forme" | "forothers" | "firm" };
type View = "list" | "split" | "map" | "cal";
const WHO = [["mine", "Ale mele"], ["forothers", "Făcute pentru colegi"], ["forme", "Făcute pentru mine"], ["firm", "Ale firmei"]] as const;
const ico = (d: React.ReactNode) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const VIEWS: [View, string, React.ReactNode][] = [
  ["list", "Listă", ico(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />)],
  ["split", "Listă + hartă", ico(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M11 4v16" /></>)],
  ["map", "Hartă", ico(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>)],
  ["cal", "Calendar", ico(<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>)],
];
const DAYS = ["LUN", "MAR", "MIE", "JOI", "VIN", "SÂM", "DUM"];
const H0 = 7, H1 = 20, HH = 48; // calendar: 07–20, 48 px per hour

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monday = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(j.error || "Nu a mers. Încearcă din nou.");
  return j;
}

function Badge({ s }: { s: Status }) {
  return <span className="inBadge" style={{ color: STATUS[s].fg, background: STATUS[s].bg }}>{STATUS[s].label}</span>;
}

/** Inspecții: the list with the three tabs (mine / done for colleagues / done for me), status filters and the list / map / calendar views. */
export function InspList({ rows: initial, meId, ops, mergeOrg = null, firmOrgs = [] }: { rows: Row[]; meId: string; ops?: boolean; mergeOrg?: string | null; firmOrgs?: string[] }) {
  const [rows, setRows] = useState(initial);
  // the office's administrator IS the firm: "Ale mele" also holds the firm's inspections prepared by colleagues. The operationals get
  // "Ale firmei" (every inspection of the firm) instead of "Ale mele" / "Făcute pentru colegi".
  const inTab = (r: Row, k: Row["who"]) => (k === "firm" ? !!r.org_id && firmOrgs.includes(r.org_id)
    : k === "mine" ? r.who === "mine" || (r.who === "firm" && !!mergeOrg && r.org_id === mergeOrg) : r.who === k);
  const tabs = WHO.filter(([k]) => (k === "firm" ? firmOrgs.length > 0 : !(ops && (k === "forothers" || k === "mine"))));
  const [who, setWho] = useState<Row["who"]>(ops ? "firm" : "mine");
  const [st, setSt] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("list");
  const [msg, setMsg] = useState("");
  const [focus, setFocus] = useState<string | null>(null); // split view: the card / pin pointed at
  useEffect(() => { try { const v = localStorage.getItem("insp-view"); if (v === "map" || v === "cal" || v === "split") setView(v); } catch {} }, []);
  const pick = (v: View) => { setView(v); try { localStorage.setItem("insp-view", v); } catch {} };

  const inWho = rows.filter((r) => inTab(r, who));
  const shown = inWho.filter((r) => (st === "all" || r.status === st) && (!q.trim() || `${r.address} ${r.cad_nr ?? ""} ${r.contact_name ?? ""} ${r.code}`.toLowerCase().includes(q.trim().toLowerCase())));

  async function schedule(id: string, when: string) {
    setMsg("");
    try {
      await post({ action: "schedule", id, scheduled_at: when });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, scheduled_at: when, status: "plan" } : r)));
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="inList">
      <div className="inBar">
        <div className="inWho" role="tablist" aria-label="Ale cui">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={who === k} onClick={() => { setWho(k); setSt("all"); }}>
              {l} <span>{rows.filter((r) => inTab(r, k)).length}</span>
            </button>
          ))}
        </div>
        <div className="inSeg" role="group" aria-label="Vizualizare">
          {VIEWS.map(([k, l, ico]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => pick(k)} title={l}>{ico}<span>{l}</span></button>
          ))}
        </div>
        <a className="btn btnGold inNew" href="/inspectii/nou"><span aria-hidden="true">+</span> Inspecție nouă</a>
      </div>
      {/* the status tabs and the search, on one line */}
      <div className="inFilterBar">
        <div className="inTabs" role="tablist" aria-label="Stare">
          <button type="button" role="tab" aria-selected={st === "all"} onClick={() => setSt("all")}>Toate <b>{inWho.length}</b></button>
          {STATUSES.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={st === k} onClick={() => setSt(k)}>
              {STATUS[k].label} <b>{inWho.filter((r) => r.status === k).length}</b>
            </button>
          ))}
        </div>
        <label className="inSearchBox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută adresă, nr. cadastral, contact, cod…" aria-label="Caută" />
          {q ? <><em>{shown.length}</em><button type="button" aria-label="Golește căutarea" onClick={() => setQ("")}>×</button></> : <kbd aria-hidden="true">↵</kbd>}
        </label>
      </div>
      {msg && <p className="note" role="alert">{msg}</p>}

      {view === "list" && (shown.length ? (
        <div className="card inTableBox">
          <table className="table inTable">
            <thead><tr><th>Bunul</th><th>Contact</th><th>Programare</th><th>{who === "forothers" ? "Pentru" : who === "forme" ? "Făcută de" : "Cine o face"}</th><th>Stare</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><a className="inAddr" href={`/inspectii/${r.id}`}><b>{r.address}</b><small>{[r.prop_type, r.cad_nr && `nr. cad. ${r.cad_nr}`, r.code].filter(Boolean).join(" · ")}</small></a></td>
                  <td>{r.contact_name || "—"}</td>
                  <td className="nowrap">{fmtWhen(r.scheduled_at)}</td>
                  <td>{who === "forothers" ? <span className="inPerson"><UserAv id={r.created_by} name={r.owner_name} has={r.owner_av} size={26} />{r.owner_name}</span>
                    : r.assignee_kind === "collab" && !r.assignee_id ? "Coleg din Colaborări (de ales)"
                    : r.assignee_id ? <span className="inPerson"><UserAv id={r.assignee_id} name={r.assignee_name ?? "?"} has={r.assignee_av} size={26} />{r.assignee_id === meId ? "Eu" : r.assignee_name}
                        {r.assign_state === "pending" && <em className="inAsk">așteaptă acceptarea</em>}</span>
                    : r.assign_state === "declined" ? <em className="inAsk no">Refuzată · alege altcineva</em> : "—"}</td>
                  <td><Badge s={r.status} /></td>
                  <td className="right"><a className="rowLink" href={r.status === "prog" ? `/inspectii/nou?id=${r.id}` : `/inspectii/${r.id}`}>
                    {r.status === "gata" || r.status === "pred" ? "Vezi fișa →" : r.status === "lucru" ? "Fișa în lucru →" : r.status === "prog" ? "Programează" : "Detalii →"}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty who={who} />)}

      {view === "split" && (shown.length ? (
        <div className="inSplit">
          <div className="inSplitList">
            {shown.map((r) => (
              <a key={r.id} id={`ic-${r.id}`} href={`/inspectii/${r.id}`} className={`inCard${focus === r.id ? " on" : ""}`}
                onMouseEnter={() => setFocus(r.id)} onMouseLeave={() => setFocus(null)}>
                <span className="inCardTop"><Badge s={r.status} /><small>{fmtWhen(r.scheduled_at)}</small></span>
                <b>{r.address}</b>
                <small>{[r.prop_type, r.cad_nr && `nr. cad. ${r.cad_nr}`, r.contact_name].filter(Boolean).join(" · ")}</small>
                {r.lat == null && <em>fără poziție pe hartă</em>}
              </a>
            ))}
          </div>
          <MapView rows={shown} focus={focus} onPin={(id) => { setFocus(id); document.getElementById(`ic-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }} bare />
        </div>
      ) : <Empty who={who} />)}
      {view === "map" && <MapView rows={shown} />}
      {view === "cal" && <CalView rows={shown} unplanned={inWho.filter((r) => r.status === "prog")} onSchedule={schedule} />}
    </div>
  );
}

function Empty({ who }: { who: Row["who"] }) {
  return (
    <div className="card inEmpty">
      <b>{who === "firm" ? "Firma nu are încă inspecții" : who === "mine" ? "Nicio inspecție încă" : who === "forme" ? "Niciun coleg nu face încă inspecții pentru tine" : "Nu faci încă inspecții pentru colegi"}</b>
      <p className="hint">{who === "firm" ? "Aici apar toate inspecțiile biroului, indiferent cine le-a pregătit sau cine le face." : who === "mine" ? "Pregătește prima inspecție: bunul, fișa, contactul și programarea. Pe telefon doar o faci." : "Le vei vedea aici când un coleg din birou sau din Colaborări îți trimite o inspecție."}</p>
      {(who === "mine" || who === "firm") && <a className="btn btnGold" href="/inspectii/nou">Inspecție nouă</a>}
    </div>
  );
}

/* ---------- map (Leaflet, satellite / map) ---------- */

type LeafletNS = { map: (el: HTMLElement, o?: object) => LMap; tileLayer: (u: string, o?: object) => { addTo: (m: LMap) => unknown }; divIcon: (o: object) => unknown;
  marker: (ll: [number, number], o?: object) => { addTo: (m: LMap) => { bindTooltip: (t: string) => unknown }; on: (e: string, f: () => void) => unknown };
  latLngBounds: (a: [number, number][]) => unknown; layerGroup: () => { addTo: (m: LMap) => LGroup } };
type LMap = { fitBounds: (b: unknown, o?: object) => void; setView: (ll: [number, number], z: number) => void; invalidateSize: () => void; remove: () => void };
type LGroup = { clearLayers: () => void };
let leaflet: Promise<LeafletNS> | null = null;
function loadLeaflet() {
  leaflet ??= new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => res((window as unknown as { L: LeafletNS }).L); s.onerror = rej; document.head.appendChild(s);
  });
  return leaflet;
}

function MapView({ rows, focus = null, onPin, bare = false }: { rows: Row[]; focus?: string | null; onPin?: (id: string) => void; bare?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const placed = useMemo(() => rows.filter((r) => r.lat != null && r.lng != null), [rows]);
  // split view: the pin of the card pointed at is highlighted
  useEffect(() => {
    el.current?.querySelectorAll<HTMLElement>(".inPin").forEach((p) => p.classList.toggle("on", p.dataset.id === focus));
  }, [focus]);
  const pinRef = useRef(onPin); pinRef.current = onPin;
  useEffect(() => {
    let m: LMap | null = null, gone = false;
    loadLeaflet().then((L) => {
      if (gone || !el.current) return;
      m = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      placed.forEach((r, i) => {
        const icon = L.divIcon({ className: "", html: `<span class="inPin" data-id="${r.id}" style="background:${STATUS[r.status].fg}">${i + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 28] });
        const mk = L.marker([r.lat!, r.lng!], { icon });
        mk.addTo(m!).bindTooltip(`${r.address} · ${STATUS[r.status].label}`);
        mk.on("click", () => { if (pinRef.current) pinRef.current(r.id); else location.href = `/inspectii/${r.id}`; });
      });
      if (placed.length) m.fitBounds(L.latLngBounds(placed.map((r) => [r.lat!, r.lng!])), { padding: [40, 40], maxZoom: 15 });
      else m.setView([45.75, 21.23], 9);
    }).catch(() => {});
    return () => { gone = true; m?.remove(); };
  }, [placed]);
  if (bare) return <div ref={el} className="inMap inSplitMap" role="region" aria-label="Harta inspecțiilor" />;
  return (
    <div className="inMapWrap">
      <div ref={el} className="inMap" role="region" aria-label="Harta inspecțiilor" />
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

function CalView({ rows, unplanned, onSchedule }: { rows: Row[]; unplanned: Row[]; onSchedule: (id: string, when: string) => void }) {
  const [start, setStart] = useState(() => monday(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const today = ymd(new Date());
  const end = days[6];
  const title = start.getMonth() === end.getMonth() ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  const move = (w: number) => setStart((s) => { const d = new Date(s); d.setDate(d.getDate() + 7 * w); return d; });
  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
  const drop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/insp");
    if (!id) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const h = Math.max(H0, Math.min(H1 - 1, H0 + Math.floor((y / HH) * 2) / 2));
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
            <div className="inCalHours">{Array.from({ length: H1 - H0 }, (_, i) => <span key={i} style={{ height: HH }}>{pad(H0 + i)}</span>)}</div>
            {days.map((d, i) => {
              const key = ymd(d);
              const evs = rows.filter((r) => r.scheduled_at?.startsWith(key));
              return (
                <div key={i} className={`inCalCol${key === today ? " today" : ""}${i > 4 ? " wk" : ""}`} style={{ height: (H1 - H0) * HH }}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, d)}>
                  {evs.map((r) => {
                    const [hh, mm] = r.scheduled_at!.slice(11, 16).split(":").map(Number);
                    const top = Math.max(0, (hh + mm / 60 - H0) * HH), h = Math.max(24, (r.duration_min / 60) * HH - 4);
                    return (
                      <a key={r.id} href={`/inspectii/${r.status === "prog" || r.status === "plan" ? `nou?id=${r.id}` : r.id}`} className="inEv"
                        style={{ top: top + 2, height: h, color: STATUS[r.status].fg, background: STATUS[r.status].bg }}>
                        <b>{r.scheduled_at!.slice(11, 16)} · {r.address.split(",")[0]}</b><small>{STATUS[r.status].label}</small>
                      </a>
                    );
                  })}
                  {key === today && nowH > H0 && nowH < H1 && <span className="inNow" style={{ top: (nowH - H0) * HH }} />}
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
