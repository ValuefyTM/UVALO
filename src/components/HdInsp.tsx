"use client";

// The new home (variant B): the inspections card — the map on top (full width), the next inspections as rows under it,
// or the week's calendar. Without any open inspection: a faded map with a light placemark and "Pregătește prima inspecție".
import { useEffect, useState } from "react";
import { CalView, MapView } from "./InspList";
import { UserAv } from "./UserAv";
import { STATUS, type InspRow } from "@/lib/insp-shared";

export type HdRow = InspRow & { who: "mine" | "forme" | "forothers" | "firm" };
const KEY = "home-insp-view";
const TZ = "Europe/Bucharest";

const WD = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];
const MO = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
/** The date and time of an open inspection: ["10:00", "azi"], ["14:00", "mâine"], ["10:00", "vin 17 oct"], null = no date. */
function when(r: HdRow): [string, string] | null {
  const at = r.scheduled_at;
  if (!at) return null;
  const day = at.slice(0, 10), time = at.slice(11, 16);
  const off = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  const d = new Date(`${day}T12:00:00Z`);
  const date = day === off(0) ? "azi" : day === off(1) ? "mâine" : day === off(-1) ? "ieri" : `${WD[d.getUTCDay()].toLowerCase()} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
  return [time || "—", date];
}

export function HdInsp({ rows: initial, list, meId, title, tags, empty }: { rows: HdRow[]; list: HdRow[]; meId: string; title: React.ReactNode; tags: React.ReactNode; empty: React.ReactNode }) {
  const [view, setView] = useState<"map" | "cal">("map");
  const [rows, setRows] = useState(initial);
  const [focus, setFocus] = useState<string | null>(null); // the row pointed at lights up its pin
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
      <div className="hbHead">
        {title}
        <div className="hdSeg" role="group" aria-label="Mod de afișare">
          <button type="button" aria-pressed={view === "map"} onClick={() => pick("map")}>Hartă</button>
          <button type="button" aria-pressed={view === "cal"} onClick={() => pick("cal")}>Calendar</button>
        </div>
        <a className="hbMore" href="/inspectii">Toate →</a>
      </div>
      {tags}
      {view === "map" ? (
        <>
          <div className={`hbMap${placed.length ? "" : " ghost"}`}>
            {placed.length ? (
              <>
                <MapView rows={placed} focus={focus} bare />
                <span className="hdLegend" aria-hidden="true">
                  {(["lucru", "plan", "prog"] as const).map((s) => <span key={s}><i style={{ background: STATUS[s].fg }} />{STATUS[s].label}</span>)}
                </span>
              </>
            ) : (
              <div className="hbEmpty bare">
                <i><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z" /><circle cx="12" cy="11" r="2.2" /></svg></i>
                <b>{list.length ? "Inspecțiile cu adresă găsită apar aici, pe hartă" : "Nicio inspecție programată"}</b>
                {!list.length && <p>Inspecțiile tale vor apărea aici, pe hartă și în calendar.</p>}
              </div>
            )}
          </div>
          {list.length ? (
            <div className="hbRows" aria-label="Următoarele inspecții">
              {list.map((r) => {
                const n = placed.findIndex((p) => p.id === r.id);
                const w = when(r);
                const prog = r.status === "prog" || (r.status === "plan" && r.created_by === meId && !r.scheduled_at);
                return (
                  <a key={r.id} className={`hbRow${focus === r.id ? " on" : ""}`} href={prog ? `/inspectii/nou?id=${r.id}` : `/inspectii/${r.id}`}
                    onMouseEnter={() => setFocus(r.id)} onMouseLeave={() => setFocus(null)}>
                    <span className="hdNum" style={{ background: n >= 0 ? STATUS[r.status].fg : "#BDB3A0" }}>{n >= 0 ? n + 1 : "·"}</span>
                    <span className="hbRowTxt">
                      <b title={r.address}>{r.address}</b>
                      <small>
                        <span className="hdChip" style={{ color: STATUS[r.status].fg, background: STATUS[r.status].bg }}>{r.assign_state === "pending" ? "Solicitare" : STATUS[r.status].label}</span>
                        {r.prop_type && <span>{r.prop_type}</span>}
                        {r.assignee_id && r.assignee_id !== meId && <span className="hbWho"><UserAv id={r.assignee_id} name={r.assignee_name ?? "?"} has={r.assignee_av} size={18} />{(r.assignee_name ?? "").split(" ").slice(0, 2).join(" ")}</span>}
                        {r.assign_state === "pending" && <em>așteaptă acceptarea</em>}
                      </small>
                    </span>
                    {w ? <span className="hbWhen"><b>{w[0]}</b><small>{w[1]}</small></span> : <span className="hbBtn line sm">Programează</span>}
                  </a>
                );
              })}
            </div>
          ) : empty}
        </>
      ) : (
        <div className="hdCal"><CalView rows={rows.filter((r) => r.scheduled_at)} unplanned={rows.filter((r) => r.status === "prog" && !r.scheduled_at)} onSchedule={schedule} /></div>
      )}
    </>
  );
}
