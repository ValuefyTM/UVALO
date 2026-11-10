"use client";
// The inspection's location, on the last step before signing: a map with the GPS position (blue dot) and a gold pin = where
// the inspection was made. The pin starts on the GPS fix taken when the sheet was opened, can be dragged onto the property
// (the GPS is often off by tens of metres between houses), or put back on the GPS / on the geocoded address.
import { useEffect, useRef, useState } from "react";

export type Loc = { lat: number; lng: number; acc: number | null; at: string; src: "gps" | "manual" };

/* eslint-disable @typescript-eslint/no-explicit-any */
type L = any;
let leaflet: Promise<L> | null = null;
function loadLeaflet(): Promise<L> {
  leaflet ??= new Promise((res, rej) => {
    const w = window as unknown as { L?: L };
    if (w.L) return res(w.L);
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    sc.onload = () => res((window as unknown as { L: L }).L); sc.onerror = rej; document.head.appendChild(sc);
  });
  return leaflet;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
const distM = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180));

/** One GPS fix, or null (no permission / no signal within the timeout). */
export const gpsFix = (timeout = 15000) => new Promise<Loc | null>((res) => {
  if (!("geolocation" in navigator)) return res(null);
  navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? null, at: new Date().toISOString(), src: "gps" }),
    () => res(null), { enableHighAccuracy: true, timeout, maximumAge: 20000 });
});

export function LocPick({ loc, addr, onChange }: { loc: Loc | null; addr: [number, number] | null; onChange: (l: Loc | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L>(null), pin = useRef<L>(null), dot = useRef<L>(null), ring = useRef<L>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [live, setLive] = useState<[number, number] | null>(null);
  const start: [number, number] = loc ? [loc.lat, loc.lng] : addr ?? [45.7489, 21.2087];
  // the map, once
  useEffect(() => {
    let gone = false;
    loadLeaflet().then((Lf) => {
      if (gone || !el.current || map.current) return;
      const m = Lf.map(el.current, { zoomControl: false, attributionControl: false });
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
      const p = Lf.marker(start, { draggable: true, icon: Lf.divIcon({ className: "", html: '<span class="mbPin" style="background:#E0AD4F"><b>●</b></span>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(m);
      if (addr) Lf.circleMarker(addr, { radius: 6, color: "#fff", weight: 2, fillColor: "#8a7a5a", fillOpacity: 1, interactive: false }).addTo(m); // the address from the preparation
      p.on("dragend", () => { const q = p.getLatLng(); onChange({ lat: +q.lat.toFixed(6), lng: +q.lng.toFixed(6), acc: null, at: new Date().toISOString(), src: "manual" }); });
      // the pin and the prepared address both in view (the GPS often lands a street away), never closer than zoom 17
      if (loc && addr) m.fitBounds(Lf.latLngBounds([[loc.lat, loc.lng], addr]), { padding: [30, 30], maxZoom: 17 });
      else m.setView(start, loc || addr ? 17 : 12);
      map.current = m; pin.current = p;
    }).catch(() => setMsg("Harta nu s-a putut încărca (fără semnal?). Coordonatele GPS se salvează oricum."));
    return () => { gone = true; map.current?.remove(); map.current = null; pin.current = null; dot.current = null; ring.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the pin follows the value (GPS taken again, address)
  useEffect(() => {
    if (!map.current || !pin.current || !loc) return;
    pin.current.setLatLng([loc.lat, loc.lng]);
    map.current.panTo([loc.lat, loc.lng]);
    if (ring.current) ring.current.remove();
    if (loc.src === "gps" && loc.acc && loc.acc > 5) ring.current = (window as unknown as { L: L }).L.circle([loc.lat, loc.lng], { radius: loc.acc, color: "#2563eb", weight: 1, fillOpacity: 0.08 }).addTo(map.current);
  }, [loc]);
  // the live position (blue dot) while this screen is open
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition((p) => setLive([p.coords.latitude, p.coords.longitude]), () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  useEffect(() => {
    const Lf = (window as unknown as { L?: L }).L;
    if (!map.current || !live || !Lf) return;
    if (dot.current) dot.current.setLatLng(live);
    else dot.current = Lf.circleMarker(live, { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map.current);
  }, [live]);
  const useGps = async () => {
    setBusy(true); setMsg("");
    const f = await gpsFix();
    setBusy(false);
    if (!f) { setMsg("Nu am primit poziția. Verifică permisiunea de locație și semnalul GPS."); return; }
    onChange(f);
    map.current?.setView([f.lat, f.lng], 17);
  };
  const dAddr = loc && addr ? Math.round(distM([loc.lat, loc.lng], addr)) : null;
  return (
    <section className="mbCard mbLoc">
      <span className="mbRowBetween"><small className="mbCap">LOCAȚIA INSPECȚIEI</small>{loc && <small className="mbLocSrc">{loc.src === "gps" ? `GPS${loc.acc ? ` · ±${Math.round(loc.acc)} m` : ""} · ${hhmm(loc.at)}` : `pin mutat manual · ${hhmm(loc.at)}`}</small>}</span>
      <div ref={el} className="mbLocMap" aria-label="Harta locației" />
      <small className="mbLocHint">{loc ? `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}${dAddr != null ? ` · la ${dAddr} m de adresa din pregătire` : ""}. Trage pinul auriu pe imobil dacă GPS-ul a nimerit alături.` : "Încă nu avem poziția. Apasă „Folosește GPS-ul” sau trage pinul pe imobil."}</small>
      <span className="mbOpts">
        <button type="button" onClick={useGps} disabled={busy}>{busy ? "Se caută poziția…" : loc ? "Ia din nou GPS-ul" : "Folosește GPS-ul"}</button>
        {addr && <button type="button" onClick={() => { onChange({ lat: addr[0], lng: addr[1], acc: null, at: new Date().toISOString(), src: "manual" }); map.current?.setView(addr, 17); }}>Pune pinul pe adresă</button>}
      </span>
      {msg && <small className="mbNote">{msg}</small>}
    </section>
  );
}
