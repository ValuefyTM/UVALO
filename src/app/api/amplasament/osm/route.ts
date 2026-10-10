import { locatorAccess } from "@/lib/locator";

// Site analysis (/amplasament): what is around a point, from OpenStreetMap (Overpass API, free, no key).
// Points of interest within 1.5 km, the streets that touch the parcel, the main roads, the things that can lower
// the value (power lines, railway, industry, cemeteries…) and the localities around. Distances in straight line.
// Answers are kept a week in the worker's cache (per point, about 10 m apart), so Overpass is asked once.

const ENDPOINTS = () => [process.env.OVERPASS_URL, "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
  .filter((u): u is string => !!u);

type El = { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> };

/** Categories of points of interest, in the order the page shows them. */
const CATS: { key: string; label: string; test: (t: Record<string, string>) => boolean }[] = [
  { key: "shop", label: "Magazin alimentar", test: (t) => /^(supermarket|convenience|bakery|butcher|greengrocer)$/.test(t.shop ?? "") },
  { key: "transport", label: "Stație transport în comun", test: (t) => t.highway === "bus_stop" || t.public_transport === "platform" || t.railway === "tram_stop" },
  { key: "kindergarten", label: "Grădiniță", test: (t) => t.amenity === "kindergarten" },
  { key: "school", label: "Școală", test: (t) => t.amenity === "school" },
  { key: "pharmacy", label: "Farmacie", test: (t) => t.amenity === "pharmacy" },
  { key: "health", label: "Unitate medicală", test: (t) => /^(hospital|clinic|doctors)$/.test(t.amenity ?? "") },
  { key: "park", label: "Parc / loc de joacă", test: (t) => /^(park|playground)$/.test(t.leisure ?? "") },
  { key: "mall", label: "Centru comercial", test: (t) => t.shop === "mall" },
  { key: "bank", label: "Bancă / poștă", test: (t) => /^(bank|post_office)$/.test(t.amenity ?? "") },
  { key: "food", label: "Restaurant / cafenea", test: (t) => /^(restaurant|cafe|fast_food)$/.test(t.amenity ?? "") },
  { key: "sport", label: "Bază sportivă", test: (t) => /^(sports_centre|pitch|fitness_centre|stadium)$/.test(t.leisure ?? "") },
  { key: "station", label: "Gară", test: (t) => t.railway === "station" || t.railway === "halt" },
  { key: "university", label: "Universitate", test: (t) => /^(university|college)$/.test(t.amenity ?? "") },
  { key: "fuel", label: "Benzinărie", test: (t) => t.amenity === "fuel" },
  { key: "worship", label: "Lăcaș de cult", test: (t) => t.amenity === "place_of_worship" },
];

/** Things that can lower the value, with the distance up to which they are worth mentioning. */
const NEG: { key: string; label: (t: Record<string, string>) => string; test: (t: Record<string, string>) => boolean; max: number }[] = [
  { key: "power", label: (t) => `linie electrică aeriană${t.voltage ? ` de ${Math.round(+t.voltage.split(";")[0] / 1000)} kV` : ""}`, test: (t) => t.power === "line", max: 1500 },
  { key: "rail", label: () => "cale ferată", test: (t) => t.railway === "rail", max: 1500 },
  { key: "industrial", label: () => "zonă industrială", test: (t) => t.landuse === "industrial", max: 1500 },
  { key: "cemetery", label: () => "cimitir", test: (t) => t.landuse === "cemetery" || t.amenity === "grave_yard", max: 1000 },
  { key: "wastewater", label: () => "stație de epurare", test: (t) => t.man_made === "wastewater_plant", max: 2000 },
  { key: "landfill", label: () => "depozit de deșeuri", test: (t) => t.landuse === "landfill", max: 3000 },
  { key: "motorway", label: (t) => `autostradă${t.ref ? ` ${t.ref}` : ""} (zgomot)`, test: (t) => t.highway === "motorway", max: 500 },
];

const ROAD_KIND: Record<string, string> = {
  motorway: "autostradă", trunk: "drum național / expres", primary: "drum principal", secondary: "drum secundar", tertiary: "stradă colectoare",
  residential: "stradă rezidențială", unclassified: "drum local", living_street: "stradă rezidențială", service: "drum de serviciu / acces", track: "drum de pământ",
};

function query(lat: number, lng: number) {
  const at = (r: number) => `(around:${r},${lat},${lng})`;
  return `[out:json][timeout:25];
(
  nwr${at(1500)}[amenity~"^(school|kindergarten|pharmacy|hospital|clinic|doctors|bank|post_office|place_of_worship|restaurant|cafe|fast_food|fuel|university|college)$"];
  nwr${at(1500)}[shop~"^(supermarket|convenience|bakery|butcher|greengrocer|mall)$"];
  nwr${at(1500)}[leisure~"^(park|playground|sports_centre|pitch|fitness_centre|stadium)$"];
  node${at(1500)}[highway=bus_stop];
  node${at(1500)}[public_transport=platform];
  node${at(2500)}[railway~"^(tram_stop|station|halt)$"];
);
out tags center qt;
way${at(120)}[highway][highway!~"^(footway|path|cycleway|steps|corridor|bridleway|proposed|construction|platform)$"];
out tags geom qt;
way${at(3000)}[highway~"^(motorway|trunk|primary|secondary)$"];
out tags geom qt;
(
  way${at(1500)}[power=line];
  way${at(1500)}[railway=rail];
  way${at(1500)}[landuse~"^(industrial|cemetery)$"];
  way${at(1000)}[amenity=grave_yard];
  way${at(2000)}[man_made=wastewater_plant];
  way${at(3000)}[landuse=landfill];
);
out tags geom qt;
node${at(30000)}[place~"^(city|town|village)$"];
out tags qt;`;
}

// Distances on a local plane (metres), accurate enough within a few kilometres.
function plane(lat0: number) {
  const ky = 111_320, kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return (lat: number, lng: number, la: number, ln: number) => [(ln - lng) * kx, (la - lat) * ky] as const;
}
function distTo(lat: number, lng: number, g: { lat: number; lon: number }[], closed: boolean) {
  const xy = plane(lat);
  const pts = g.map((p) => xy(lat, lng, p.lat, p.lon));
  if (closed && pts.length > 3) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return 0;
  }
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  if (pts.length === 1) best = Math.hypot(pts[0][0], pts[0][1]);
  return best;
}
const hav = (a: number, b: number, c: number, d: number) => {
  const R = 6371008.8, t = Math.PI / 180, x = Math.sin(((c - a) * t) / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(((d - b) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

async function overpass(q: string) {
  let last = "";
  for (const url of ENDPOINTS()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "UVALO/1.0 (app.uvalo.ro; analiza amplasamentului)" },
        body: "data=" + encodeURIComponent(q),
      });
      if (res.ok) return ((await res.json()) as { elements: El[] }).elements;
      last = `${res.status}`;
    } catch (e) {
      last = String(e);
    }
  }
  throw new Error(`Overpass: ${last}`);
}

function analyse(lat: number, lng: number, els: El[]) {
  const pois: { cat: string; name: string; lat: number; lng: number; d: number }[] = [];
  const near: { name: string; ref: string; kind: string; highway: string; surface: string; lanes: string; d: number; geom: [number, number][] }[] = [];
  const main = new Map<string, { label: string; d: number }>();
  const neg = new Map<string, { key: string; label: string; d: number }>();
  const places: { name: string; place: string; pop: number; d: number; lat: number; lng: number }[] = [];
  const seenRoad = new Set<number>();

  for (const e of els) {
    const t = e.tags ?? {};
    // places (nodes, with their coordinates)
    if (e.type === "node" && t.place && /^(city|town|village)$/.test(t.place) && e.lat != null) {
      places.push({ name: t.name ?? "", place: t.place, pop: +(t.population ?? 0) || 0, d: hav(lat, lng, e.lat, e.lon!), lat: e.lat, lng: e.lon! });
      continue;
    }
    // points of interest (nodes, or areas by their centre)
    const c = e.center ?? (e.lat != null ? { lat: e.lat, lon: e.lon! } : null);
    const cat = CATS.find((k) => k.test(t));
    if (cat && c && !e.geometry) {
      pois.push({ cat: cat.key, name: t.name ?? "", lat: c.lat, lng: c.lon, d: Math.round(hav(lat, lng, c.lat, c.lon)) });
      continue;
    }
    if (!e.geometry?.length) continue;
    const closed = e.geometry.length > 3 && e.geometry[0].lat === e.geometry[e.geometry.length - 1].lat && e.geometry[0].lon === e.geometry[e.geometry.length - 1].lon;
    const d = Math.round(distTo(lat, lng, e.geometry, closed));
    const n = NEG.find((k) => k.test(t));
    if (n && d <= n.max) {
      const was = neg.get(n.key);
      if (!was || d < was.d) neg.set(n.key, { key: n.key, label: n.label(t), d });
    }
    if (t.highway && /^(motorway|trunk|primary|secondary)$/.test(t.highway)) {
      const label = [ROAD_KIND[t.highway], t.ref, t.name].filter(Boolean).join(" ");
      const k = t.ref || t.name || `${t.highway}${e.id}`;
      const was = main.get(k);
      if (!was || d < was.d) main.set(k, { label, d });
    }
    if (t.highway && d <= 120 && !seenRoad.has(e.id)) {
      seenRoad.add(e.id);
      near.push({ name: t.name ?? "", ref: t.ref ?? "", kind: ROAD_KIND[t.highway] ?? "drum", highway: t.highway, surface: t.surface ?? "", lanes: t.lanes ?? "", d,
        geom: e.geometry.map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6]) });
    }
  }

  // nearest of each category (names merged later on the page); at most 40 per category for the counts and the map
  pois.sort((a, b) => a.d - b.d);
  const byCat = new Map<string, number>();
  const kept = pois.filter((p) => { const n = (byCat.get(p.cat) ?? 0) + 1; byCat.set(p.cat, n); return n <= 40; });
  places.sort((a, b) => a.d - b.d);
  const locality = places.find((p) => p.place !== "city" || p.d < 4000) ?? places[0] ?? null;
  // the nearest city (municipiu / big town): place=city, else the most populated town around
  const city = places.find((p) => p.place === "city") ?? [...places].filter((p) => p.place === "town").sort((a, b) => b.pop - a.pop)[0] ?? null;
  near.sort((a, b) => a.d - b.d);
  return {
    pois: kept,
    cats: CATS.map(({ key, label }) => ({ key, label })),
    roads: near.slice(0, 12),
    main: [...main.values()].sort((a, b) => a.d - b.d).slice(0, 4),
    neg: [...neg.values()].sort((a, b) => a.d - b.d),
    locality: locality && { name: locality.name, d: Math.round(locality.d), lat: locality.lat, lng: locality.lng },
    city: city && { name: city.name, d: Math.round(city.d), lat: city.lat, lng: city.lng },
  };
}

export async function GET(req: Request) {
  const a = await locatorAccess("amplasament");
  if ("status" in a) return new Response(a.status === 401 ? "Autentifică-te din nou." : "Fără acces.", { status: a.status });
  const sp = new URL(req.url).searchParams;
  const lat = Math.round(+(sp.get("lat") ?? NaN) * 1e4) / 1e4, lng = Math.round(+(sp.get("lng") ?? NaN) * 1e4) / 1e4;
  // Romania, roughly
  if (!(lat > 43.5 && lat < 48.4 && lng > 20.1 && lng < 30)) return Response.json({ error: "Punctul nu este în România." }, { status: 400 });

  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://cache.uvalo.local/amplasament/osm/v1/${lat}/${lng}`);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return new Response(hit.body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=3600" } });

  let els: El[];
  try {
    els = await overpass(query(lat, lng));
  } catch (e) {
    console.error("[amplasament/osm]", e);
    return Response.json({ error: "Serviciul OpenStreetMap nu a răspuns. Încearcă din nou peste un minut." }, { status: 502 });
  }
  const body = JSON.stringify({ at: [lat, lng], date: new Date().toISOString().slice(0, 10), ...analyse(lat, lng, els) });
  await cache?.put(key, new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=604800" } })).catch(() => {});
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=3600" } });
}
