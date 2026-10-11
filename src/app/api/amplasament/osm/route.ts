import { locatorAccess } from "@/lib/locator";

// Site analysis (/amplasament): what is around a point, from OpenStreetMap (Overpass API, free, no key).
// Points of interest within 1.5 km, the streets that touch the parcel, the main roads, the things that can lower
// the value (power lines, railway, industry, cemeteries…) and the localities around. Distances in straight line.
// Answers are kept a week in the worker's cache (per point, about 10 m apart), so Overpass is asked once.
// Overpass limits requests per IP and Cloudflare's outgoing IPs are shared by many: when every server refuses the worker,
// the answer carries the query and the page asks Overpass itself (the viewer's own IP), then POSTs the elements here.

const ENDPOINTS = () => [process.env.OVERPASS_URL, "https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
  .filter((u): u is string => !!u);

type Pt = { lat: number; lon: number };
type El = { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: Pt; geometry?: (Pt | null)[]; tags?: Record<string, string> };

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

// Kept light for the public servers: tag filter first, then the distance; the geometry of long ways and large areas
// is cut to a box of about 3 km around the point (only the part near the parcel matters for the distances).
function query(lat: number, lng: number) {
  const at = (r: number) => `(around:${r},${lat},${lng})`;
  const dy = 3000 / 111_320, dx = 3000 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const box = `(${(lat - dy).toFixed(5)},${(lng - dx).toFixed(5)},${(lat + dy).toFixed(5)},${(lng + dx).toFixed(5)})`;
  return `[out:json][timeout:60];
(
  nwr["amenity"~"^(school|kindergarten|pharmacy|hospital|clinic|doctors|bank|post_office|place_of_worship|restaurant|cafe|fast_food|fuel|university|college)$"]${at(1500)};
  nwr["shop"~"^(supermarket|convenience|bakery|butcher|greengrocer|mall)$"]${at(1500)};
  nwr["leisure"~"^(park|playground|sports_centre|pitch|fitness_centre|stadium)$"]${at(1500)};
  node["highway"="bus_stop"]${at(1500)};
  node["railway"~"^(tram_stop|station|halt)$"]${at(2500)};
);
out tags center qt;
way["highway"]["highway"!~"^(footway|path|cycleway|steps|corridor|bridleway|proposed|construction|platform)$"]${at(120)};
out tags geom${box} qt;
way["highway"~"^(motorway|trunk|primary|secondary)$"]${at(2000)};
out tags geom${box} qt;
(
  way["power"="line"]${at(1500)};
  way["railway"="rail"]${at(1500)};
  way["landuse"~"^(industrial|cemetery)$"]${at(1500)};
  way["amenity"="grave_yard"]${at(1000)};
  way["man_made"="wastewater_plant"]${at(2000)};
  way["landuse"="landfill"]${at(3000)};
);
out tags geom${box} qt;
node["place"~"^(city|town|village)$"]${at(25000)};
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
  const fails: string[] = [];
  for (const url of ENDPOINTS()) {
    const host = new URL(url).host;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "UVALO/1.0 (https://app.uvalo.ro; analiza amplasamentului)" },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const j = (await res.json().catch(() => null)) as { elements?: El[]; remark?: string } | null;
        if (j?.elements && !(j.remark && /runtime error|timed out|out of memory/i.test(j.remark))) return j.elements;
        fails.push(`${host}: ${j?.remark?.slice(0, 80) ?? "răspuns invalid"}`);
      } else fails.push(`${host}: ${res.status} ${(await res.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}`);
    } catch (e) {
      fails.push(`${host}: ${e instanceof Error && e.name === "TimeoutError" ? "timeout" : String(e).slice(0, 80)}`);
    }
  }
  throw new Error(fails.join("; "));
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
    // geometry cut to the box around the point: points outside come as null, so the way is split into pieces
    const g = e.geometry ?? [];
    const parts: Pt[][] = [[]];
    for (const q of g) if (q && Number.isFinite(q.lat)) parts[parts.length - 1].push(q); else if (parts[parts.length - 1].length) parts.push([]);
    const pieces = parts.filter((x) => x.length);
    if (!pieces.length) continue;
    const first = g[0], last = g[g.length - 1];
    const closed = pieces.length === 1 && g.length > 3 && !!first && !!last && first.lat === last.lat && first.lon === last.lon;
    const d = Math.round(Math.min(...pieces.map((x) => distTo(lat, lng, x, closed))));
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
        geom: pieces.sort((x, y) => y.length - x.length)[0].map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6]) });
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

const json = (body: string) => new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=3600" } });
function point(lat: number, lng: number) {
  lat = Math.round(lat * 1e4) / 1e4; lng = Math.round(lng * 1e4) / 1e4;
  // Romania, roughly
  return lat > 43.5 && lat < 48.4 && lng > 20.1 && lng < 30 ? { lat, lng } : null;
}
const result = (lat: number, lng: number, els: El[]) => JSON.stringify({ at: [lat, lng], date: new Date().toISOString().slice(0, 10), ...analyse(lat, lng, els) });

export async function GET(req: Request) {
  const a = await locatorAccess("amplasament");
  if ("status" in a) return new Response(a.status === 401 ? "Autentifică-te din nou." : "Fără acces.", { status: a.status });
  const sp = new URL(req.url).searchParams;
  const pt = point(+(sp.get("lat") ?? NaN), +(sp.get("lng") ?? NaN));
  if (!pt) return Response.json({ error: "Punctul nu este în România." }, { status: 400 });
  const { lat, lng } = pt;

  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`https://cache.uvalo.local/amplasament/osm/v1/${lat}/${lng}`);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return json(await hit.text());

  let els: El[];
  try {
    els = await overpass(query(lat, lng));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[amplasament/osm]", detail);
    // the page retries from the browser with this query
    return Response.json({ error: "Serverele OpenStreetMap nu au răspuns.", detail, query: query(lat, lng) }, { status: 502 });
  }
  const body = result(lat, lng, els);
  await cache?.put(key, new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=604800" } })).catch(() => {});
  return json(body);
}

/** The elements the page got from Overpass itself (when the worker was refused): analysed here, not cached (they come from the browser). */
export async function POST(req: Request) {
  const a = await locatorAccess("amplasament");
  if ("status" in a) return new Response(a.status === 401 ? "Autentifică-te din nou." : "Fără acces.", { status: a.status });
  const raw = await req.text();
  if (raw.length > 8_000_000) return Response.json({ error: "Prea multe date." }, { status: 413 });
  let b: { lat?: number; lng?: number; elements?: unknown };
  try { b = JSON.parse(raw); } catch { return Response.json({ error: "Date invalide." }, { status: 400 }); }
  const pt = point(Number(b.lat), Number(b.lng));
  if (!pt || !Array.isArray(b.elements)) return Response.json({ error: "Date invalide." }, { status: 400 });
  const els = (b.elements as El[]).filter((e) => e && typeof e === "object" && (e.type === "node" || e.type === "way" || e.type === "relation")).slice(0, 20_000);
  return json(result(pt.lat, pt.lng, els));
}
