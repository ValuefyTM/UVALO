"use client";

// The new home: the inspections on a map (with the next ones and the last finished below) or on the week's calendar.
import { useEffect, useState } from "react";
import { CalView, MapView } from "./InspList";
import { UserAv } from "./UserAv";
import { STATUS, type InspRow } from "@/lib/insp-shared";

export type HdRow = InspRow & { who: "mine" | "forme" | "forothers" | "firm" };
const KEY = "home-insp-view";
const TZ = "Europe/Bucharest";

const WD = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];
const MO = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
/** The date and time of an open inspection: "Azi · 10:00", "Mâine · 14:00", "Vin 17 oct · 10:00", "Fără dată". */
function when(r: HdRow) {
  const at = r.scheduled_at;
  if (!at) return null;
  const day = at.slice(0, 10), time = at.slice(11, 16);
  const off = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  const d = new Date(`${day}T12:00:00Z`);
  const date = day === off(0) ? "Azi" : day === off(1) ? "Mâine" : day === off(-1) ? "Ieri" : `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
  return time ? `${date} · ${time}` : date;
}

export function HdInsp({ rows: initial, list, meId, title }: { rows: HdRow[]; list: HdRow[]; meId: string; title: React.ReactNode }) {
  const [view, setView] = useState<"map" | "cal">("map");
  const [rows, setRows] = useState(initial);
  const [focus, setFocus] = useState<string | null>(null); // the card pointed at lights up its pin
  useEffect(() => { try { if (localStorage.getItem(KEY) === "cal") setView("cal"); } catch {} }, []);
  const pick = (v: "map" | "cal") => { setView(v); try { localStorage.setItem(KEY, v); } catch {} };
  const placed = rows.filter((r) => r.lat != null && r.lng != null);
  async function schedule(id: string, at: string) {
    const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schedule", id, scheduled_at: at }) });
    if (r.ok) setRows((rs) => rs.map((x) => (x.id === id ? { ...x, scheduled_at: at, status: "plan" } : x)));
    else alert(((await r.json().catch(() => ({}))) as { error?: string }).error || "Nu am putut programa inspecția.");
  }
  return (
    <>
      <div className="hdHead hdInspHead">
        {title}
        <div className="hdSeg" role="group" aria-label="Mod de afișare">
          <button type="button" aria-pressed={view === "map"} onClick={() => pick("map")}>Hartă</button>
          <button type="button" aria-pressed={view === "cal"} onClick={() => pick("cal")}>Calendar</button>
          <a href="/inspectii" className="hdSegLink">Toate →</a>
        </div>
      </div>
      {view === "map" ? (
        <div className="hdMapRow">
          <div className="hdMap">
            {placed.length ? <MapView rows={placed} focus={focus} bare /> : <p className="hdEmpty hdMapEmpty">Inspecțiile cu adresă găsită apar aici, pe hartă.</p>}
            <span className="hdLegend" aria-hidden="true">
              {(["lucru", "plan", "prog"] as const).map((s) => <span key={s}><i style={{ background: STATUS[s].fg }} />{STATUS[s].label}</span>)}
            </span>
          </div>
          <div className="hdList" aria-label="Inspecțiile de pe hartă">
            {list.length ? list.map((r) => {
              const n = placed.findIndex((p) => p.id === r.id);
              const w = when(r);
              const prog = r.status === "prog" || (r.status === "plan" && r.created_by === meId && !r.scheduled_at);
              return (
                <a key={r.id} className={`hdItem${focus === r.id ? " on" : ""}`} href={prog ? `/inspectii/nou?id=${r.id}` : `/inspectii/${r.id}`}
                  onMouseEnter={() => setFocus(r.id)} onMouseLeave={() => setFocus(null)}>
                  <span className="hdItemTop">
                    <span className="hdNum" style={{ background: n >= 0 ? STATUS[r.status].fg : "#BDB3A0" }}>{n >= 0 ? n + 1 : "·"}</span>
                    <span className="hdChip" style={{ color: STATUS[r.status].fg, background: STATUS[r.status].bg }}>{r.assign_state === "pending" ? "Solicitare" : STATUS[r.status].label}</span>
                    <span className={`hdTime${w ? "" : " none"}`}>{w ?? "Fără dată"}</span>
                  </span>
                  <b className="hdItemAddr" title={r.address}>{r.address}</b>
                  <span className="hdItemFoot">
                    <small>{[r.prop_type, r.contact_name].filter(Boolean).join(" · ")}</small>
                    {r.assignee_id
                      ? <span className="hdItemWho" title={`Inspector: ${r.assignee_name ?? ""}`}><UserAv id={r.assignee_id} name={r.assignee_name ?? "?"} has={r.assignee_av} size={20} /><span>{r.assignee_name}</span></span>
                      : <span className="hdItemWho hdMuted">nealocat</span>}
                  </span>
                  {r.assign_state === "pending" && <em className="hdItemAsk">așteaptă acceptarea</em>}
                </a>
              );
            }) : (
              <div className="hdListEmpty">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 14l2 2 4-4" /></svg>
                <b>Nu ai inspecții în curs</b>
                <span>Cele programate, în lucru sau de programat apar aici și pe hartă.</span>
                <a className="hdChipBtn" href="/inspectii/nou">+ Inspecție nouă</a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hdCal"><CalView rows={rows.filter((r) => r.scheduled_at)} unplanned={rows.filter((r) => r.status === "prog" && !r.scheduled_at)} onSchedule={schedule} /></div>
      )}
    </>
  );
}
