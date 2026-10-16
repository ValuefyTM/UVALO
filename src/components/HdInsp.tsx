"use client";

// The new home: the inspections on a map (with the next ones and the last finished below) or on the week's calendar.
import { useEffect, useState } from "react";
import { CalView, MapView } from "./InspList";
import { UserAv } from "./UserAv";
import { STATUS, type InspRow } from "@/lib/insp-shared";

export type HdRow = InspRow & { who: "mine" | "forme" | "forothers" | "firm" };
const KEY = "home-insp-view";
const TZ = "Europe/Bucharest";

function when(r: HdRow) {
  const at = r.status === "gata" || r.status === "pred" ? r.finished_at : r.scheduled_at;
  if (!at) return "Fără dată";
  const day = at.slice(0, 10), today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const yest = new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  const tom = new Date(Date.now() + 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  // finished_at is UTC; scheduled_at is the local time as typed
  const local = r.status === "gata" || r.status === "pred" ? new Date(at).toLocaleDateString("en-CA", { timeZone: TZ }) : day;
  const time = r.status === "gata" || r.status === "pred" ? new Date(at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : at.slice(11, 16);
  if (local === today) return time || "Azi";
  if (local === yest) return "Ieri";
  if (local === tom) return `Mâine ${time}`;
  return new Date(`${local}T12:00:00Z`).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

export function HdInsp({ rows: initial, list, meId, title }: { rows: HdRow[]; list: HdRow[]; meId: string; title: React.ReactNode }) {
  const [view, setView] = useState<"map" | "cal">("map");
  const [rows, setRows] = useState(initial);
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
        <>
          <div className="hdMap">
            {placed.length ? <MapView rows={placed} bare /> : <p className="hdEmpty hdMapEmpty">Inspecțiile cu adresă găsită apar aici, pe hartă.</p>}
            <span className="hdLegend" aria-hidden="true">
              {(["lucru", "plan", "prog"] as const).map((s) => <span key={s}><i style={{ background: STATUS[s].fg }} />{STATUS[s].label}</span>)}
            </span>
          </div>
          <div className="hdList">
            {list.length ? list.map((r) => {
              const n = placed.findIndex((p) => p.id === r.id);
              const prog = r.status === "prog" || (r.status === "plan" && r.created_by === meId && !r.scheduled_at);
              return (
                <a key={r.id} className="hdLine" href={prog ? `/inspectii/nou?id=${r.id}` : `/inspectii/${r.id}`}>
                  <span className="hdNum" style={{ background: n >= 0 ? STATUS[r.status].fg : "#BDB3A0" }}>{n >= 0 ? n + 1 : "·"}</span>
                  <b className="hdTime">{when(r)}</b>
                  <span className="hdAddr"><span>{r.address}</span><small>{[r.prop_type, r.sheet_no, r.photos ? `${r.photos} poze` : null, r.contact_name].filter(Boolean).join(" · ")}</small></span>
                  <span className="hdWho">{r.assignee_id ? <><UserAv id={r.assignee_id} name={r.assignee_name ?? "?"} has={r.assignee_av} size={24} /><span>{r.assignee_id === meId ? "Eu" : r.assignee_name}</span></> : <span className="hdMuted">nealocată</span>}</span>
                  <span className="hdChip" style={{ color: STATUS[r.status].fg, background: STATUS[r.status].bg }}>{r.assign_state === "pending" ? "Solicitare" : STATUS[r.status].label}</span>
                </a>
              );
            }) : <p className="hdEmpty">Nicio inspecție programată. <a href="/inspectii/nou">Creează una →</a></p>}
          </div>
        </>
      ) : (
        <div className="hdCal"><CalView rows={rows.filter((r) => r.scheduled_at)} unplanned={rows.filter((r) => r.status === "prog" && !r.scheduled_at)} onSchedule={schedule} /></div>
      )}
    </>
  );
}
