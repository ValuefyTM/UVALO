"use client";
// The small map on the web sheet (and its PDF): where the inspection was made, from the phone's GPS or the pin moved by the valuer.
import { useEffect, useRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type L = any;
let leaflet: Promise<L> | null = null;
function loadLeaflet(): Promise<L> {
  leaflet ??= new Promise((res, rej) => {
    const w = window as unknown as { L?: L };
    if (w.L) return res(w.L);
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => res((window as unknown as { L: L }).L); s.onerror = rej; document.head.appendChild(s);
  });
  return leaflet;
}

export function InspLocMap({ lat, lng, acc, addr }: { lat: number; lng: number; acc: number | null; addr: [number, number] | null }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let m: L = null, gone = false;
    loadLeaflet().then((Lf) => {
      if (gone || !el.current) return;
      m = Lf.map(el.current, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      if (acc && acc > 5) Lf.circle([lat, lng], { radius: acc, color: "#2563eb", weight: 1, fillOpacity: 0.08 }).addTo(m);
      if (addr) Lf.circleMarker(addr, { radius: 6, color: "#fff", weight: 2, fillColor: "#8a7a5a", fillOpacity: 1 }).addTo(m).bindTooltip("adresa din pregătire", { direction: "top", offset: [0, -6] });
      Lf.marker([lat, lng], { icon: Lf.divIcon({ className: "", html: '<span class="inLocPin"><b>●</b></span>', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(m).bindTooltip("locul inspecției", { direction: "top", offset: [0, -28] });
      // both the pin and the prepared address in view (the GPS often lands a street away), never closer than zoom 17
      if (addr) m.fitBounds(Lf.latLngBounds([[lat, lng], addr]), { padding: [36, 36], maxZoom: 17 });
      else m.setView([lat, lng], 17);
    }).catch(() => {});
    return () => { gone = true; m?.remove(); };
  }, [lat, lng, acc, addr]);
  return <div ref={el} className="inLocMap" />;
}
