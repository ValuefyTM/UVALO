// Server-only: the tools of the UVALO MCP server (/api/mcp) — for now only the cadastral locator: the localities with plans,
// a parcel by its number (contour, buildings, neighbours, the Timișoara layers, the 2026 notarial grid), the parcel under a
// point or an address, the notarial grid at a point, Stereo 70 ↔ WGS84. The data is the one of the locator page, read from the
// worker's assets: the parcel centres (/_localizare/c/<uat>.json) and the parcels in shards by number (/_localizare/s/<uat>/<nn>.json),
// both written by scripts/copy-localizare.mjs — a whole plan (Timișoara: 8.5 MB) is never parsed in the worker.
import { locatorAsset } from "./locator";
import { cadastralRoot, centres, uatOfName, uats, VILLAGES, type Centre, type Uat } from "./cadastre";
import { decodeRing, stereo70ToWgs84, wgs84ToStereo70 } from "./stereo70";
import { geocode } from "./gmaps";
import { origin } from "./site";

export type McpCtx = { modules: string[]; app: string };
export class ToolError extends Error {}

/* ---------- data ---------- */

const SHARDS = 32;
const shardOf = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % SHARDS).toString(16).padStart(2, "0"); };

type Rec = { id: string; a: number; n: string[]; z: number[]; t?: string[]; f?: string[]; o?: number; iv?: string[]; b?: [string, number[]][] };
const shards = new Map<string, Promise<Rec[] | null>>();
function shard(req: Request, key: string, nn: string) {
  const k = `${key}/${nn}`;
  let p = shards.get(k);
  if (p) { shards.delete(k); shards.set(k, p); return p; }
  p = locatorAsset(`s/${key}/${nn}.json`, req).then((r) => (r ? r.json().then((d) => (d as { p: Rec[] }).p) : null)).catch(() => null);
  shards.set(k, p);
  while (shards.size > 24) shards.delete(shards.keys().next().value!);
  return p;
}
/** All the contours of a parcel number in a plan (a number can be on more than one contour). */
async function records(req: Request, key: string, id: string) {
  return ((await shard(req, key, shardOf(id))) ?? []).filter((r) => r.id === id);
}

type GrStreet = { n: string; z: string; l: [number, number][]; loc: string; seg?: string; side?: number };
type GrData = { uat: string; an: number; sursa: string; scheme: Record<string, string>; streets: GrStreet[]; zones: { z: string; r: [number, number][][] }[] };
type Tbl = { t: string; u?: string; cols?: string[]; z?: Record<string, number[]>; z2?: Record<string, number[]>; levels?: Record<string, Record<string, number[]>>; by?: Record<string, unknown>; grup?: Record<string, unknown>; rows?: unknown; extravilan?: number; cat?: Record<string, string>; note?: string };
type GrValues = { sursa: string; an: number; timisoara: Record<string, Tbl> & { reduceri: string[] }; grup: Record<string, string[]>; localitati: Record<string, Tbl> & { note: string } };
type StrData = { zone: { hcl: string; an: number; p: { z: string; r: [number, number][][] }[] }; cartiere: { an: number; p: { n: string; r: [number, number][][] }[] } };

export const GR_UATS = new Set(["timisoara", "dumbravita", "giroc", "ghiroda", "mosnita-noua", "sag", "sacalaz", "dudestii-noi", "jimbolia"]);
const GR_LOC: Record<string, string> = { timisoara: "Timișoara", giroc: "Giroc", chisoda: "Chișoda", dumbravita: "Dumbrăvița", ghiroda: "Ghiroda", "mosnita-noua": "Moșnița Nouă", "mosnita-veche": "Moșnița Veche", urseni: "Urseni", sag: "Șag", sacalaz: "Săcălaz", "dudestii-noi": "Dudeștii Noi", jimbolia: "Jimbolia", sanandrei: "Sânandrei" };
const layers = new Map<string, Promise<unknown>>();
function layer<T>(req: Request, name: string): Promise<T | null> {
  let p = layers.get(name);
  if (!p) {
    p = locatorAsset(`straturi/${name}.json`, req).then((r) => (r ? r.json() : null)).catch(() => null);
    layers.set(name, p);
  }
  return p as Promise<T | null>;
}

/* ---------- geometry ---------- */

const r6 = (x: number) => Math.round(x * 1e6) / 1e6, r3 = (x: number) => Math.round(x * 1e3) / 1e3, r2 = (x: number) => Math.round(x * 100) / 100;
const inRing = (pt: number[], ring: number[][]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Even-odd test of a [lat, lng] point against rings of [lat, lng] (the layer files). */
const inRings = (ll: [number, number], rs: [number, number][][]) => {
  let c = false;
  for (const r of rs) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if (a[0] > ll[0] !== b[0] > ll[0] && ll[1] < ((b[1] - a[1]) * (ll[0] - a[0])) / (b[0] - a[0]) + a[1]) c = !c;
  }
  return c;
};
const planeCentroid = (ring: number[][]): [number, number] => {
  let s = 0, cx = 0, cy = 0;
  const [x0, y0] = ring[0];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pa = ring[j][0] - x0, pb = ring[j][1] - y0, qa = ring[i][0] - x0, qb = ring[i][1] - y0, f = pa * qb - qa * pb;
    s += f; cx += (pa + qa) * f; cy += (pb + qb) * f;
  }
  if (Math.abs(s) < 1e-9) return [x0 + ring.reduce((t, q) => t + q[0] - x0, 0) / ring.length, y0 + ring.reduce((t, q) => t + q[1] - y0, 0) / ring.length];
  return [x0 + cx / (3 * s), y0 + cy / (3 * s)];
};
const planeArea = (r: number[][]) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(s / 2); };

/** A contour of the plan (Stereo 70 [E, N]) as the numbers a valuer writes: X = north, Y = east, GPS, side lengths. */
function contour(ring: number[][]) {
  const pts = ring.map(([E, N], k) => {
    const [lat, lng] = stereo70ToWgs84(E, N);
    const nx = ring[(k + 1) % ring.length];
    return { pct: k + 1, x: r3(N), y: r3(E), lat: r6(lat), lng: r6(lng), latura_m: r2(Math.hypot(nx[0] - E, nx[1] - N)) };
  });
  const [E, N] = planeCentroid(ring), [lat, lng] = stereo70ToWgs84(E, N);
  return { pts, perimetru_m: r2(pts.reduce((s, p) => s + p.latura_m, 0)), centru: { lat: r6(lat), lng: r6(lng), stereo70: { x: r3(N), y: r3(E) } }, ll: [lat, lng] as [number, number] };
}

const geojson = (ring: number[][], props: Record<string, unknown>) => ({
  type: "Feature", properties: props,
  geometry: { type: "Polygon", coordinates: [[...ring, ring[0]].map(([E, N]) => { const [lat, lng] = stereo70ToWgs84(E, N); return [r6(lng), r6(lat)]; })] },
});

/* ---------- the layers: Timișoara (cartiere, zone de impozitare) and the 2026 notarial grid ---------- */

async function timisoaraInfo(req: Request, ll: [number, number]) {
  const d = await layer<StrData>(req, "timisoara");
  if (!d) return null;
  const z = d.zone.p.find((q) => inRings(ll, q.r)), c = d.cartiere.p.find((q) => inRings(ll, q.r));
  if (!z && !c) return null;
  return { cartier: c?.n ?? null, zona_impozitare: z ? `Zona ${z.z}` : null, sursa: `Zonele după HCL ${d.zone.hcl} (pentru ${d.zone.an}), cartierele după harta din ${d.cartiere.an}. Orientativ: verifică încadrarea în certificatul fiscal.` };
}

const grIdx = (z: string) => { const i = "012345".indexOf(z[0]); if (i >= 0) return i; const j = "ABCDE".indexOf(z[0]); return j >= 0 ? j + 1 : 3; };
/** The zone at a point: the zone surface it falls in, else the nearest zoned street (≤ 250 m), with that street and the distance. */
function grAt(d: GrData, ll: [number, number]) {
  const zs = d.zones.filter((z) => inRings(ll, z.r));
  const z = zs.length ? zs[zs.length - 1] : null;
  const ky = Math.cos((ll[0] * Math.PI) / 180) * 111320, kx = 111320;
  let best: { d2: number; s: GrStreet } | null = null;
  for (const s of d.streets) for (let i = 1; i < s.l.length; i++) {
    const ax = (s.l[i - 1][1] - ll[1]) * ky, ay = (s.l[i - 1][0] - ll[0]) * kx, bx = (s.l[i][1] - ll[1]) * ky, by = (s.l[i][0] - ll[0]) * kx;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    const d2 = (ax + t * dx) ** 2 + (ay + t * dy) ** 2;
    if (!best || d2 < best.d2) best = { d2, s };
  }
  const st = best && best.d2 < 250 * 250 ? best.s : null;
  return { zone: z ? z.z : st ? st.z : null, street: st, dist: best ? Math.sqrt(best.d2) : null, loc: st ? st.loc : Object.keys(d.scheme)[0] };
}
const cols = (names: string[] | undefined, v: unknown) => (Array.isArray(v) && names ? Object.fromEntries(names.map((n, i) => [n, v[i] ?? null])) : v ?? null);
/** Every minimum value of the study for a zone (Timișoara: zones 0–5; the localities: A–E, by locality and by its group A/B/C). */
function grValues(V: GrValues, k: string, zone: string, loc: string) {
  const zk = zone === "4/5" ? "4" : zone, ap = (t: Tbl) => cols(t.cols, (t.z ?? t.z2)?.[zk] ?? (t.z ?? t.z2)?.[String(grIdx(zk))] ?? (t.z ?? t.z2)?.[String(grIdx(zk) - (grIdx(zk) % 2))]);
  if (k === "timisoara") {
    const T = V.timisoara, pk = String(grIdx(zk) - (grIdx(zk) % 2));
    const lv = (t: Tbl) => Object.fromEntries(Object.entries(t.levels ?? {}).map(([l, z]) => [l, cols(t.cols, z[pk] ?? z["0"])]));
    return {
      zona: `Zona ${zone}`, localitate: "Timișoara", sursa: V.sursa,
      teren_intravilan_eur_mp: T.teren.z?.[zk]?.[0] ?? null, teren_extravilan_eur_mp: T.teren.extravilan ?? null,
      apartamente_eur_mp_util: { [T.ap_old.t]: ap(T.ap_old), [T.ap_new.t]: ap(T.ap_new), [T.ap_casa.t]: ap(T.ap_casa) },
      spatii_comerciale_eur_mp_util: ap(T.com),
      case_eur_mp_construit_desfasurat: { [T.casa_pe.t]: lv(T.casa_pe), [T.casa_p.t]: lv(T.casa_p), [T.casa_lemn.t]: ap(T.casa_lemn) },
      anexe_eur_mp: { [T.anexa_car.t]: ap(T.anexa_car), [T.anexa_lemn.t]: ap(T.anexa_lemn) },
      garaje_parcari: T.garaj.rows, hoteluri_eur_mp_desfasurat: ap(T.hotel), pensiuni_eur_mp_desfasurat: ap(T.pensiune),
      industrial_eur_mp_desfasurat: Object.fromEntries(Object.entries((T.industrial.rows ?? {}) as Record<string, number[]>).map(([n, v]) => [n, cols(T.industrial.cols, v)])),
      reguli: T.reduceri,
    };
  }
  const L = V.localitati, name = GR_LOC[loc] ?? loc, grup = Object.keys(V.grup).find((g) => V.grup[g].includes(name)) ?? "C";
  const by = (t: Tbl) => { const b = t.by ?? {}; let v = b[name] !== undefined ? b[name] : b["*"]; if (v && typeof v === "object" && !Array.isArray(v)) { const o = v as Record<string, unknown>; v = o[zone] ?? o[Object.keys(o)[0]]; } return cols(t.cols, v); };
  const g = (t: Tbl) => cols(t.cols, (t.grup ?? {})[grup]);
  const ind = (L.industrial.grup?.[grup] as number[][] | undefined) ?? [];
  return {
    zona: `Zona ${zone}`, localitate: name, grup_localitate: grup, sursa: V.sursa,
    teren_intravilan_eur_mp: by(L.teren), teren_intravilan_nota: L.teren.note ?? null,
    teren_extravilan_arabil_eur_ha: (L.extravilan.by ?? {})[name] ?? null, teren_extravilan_categorii: L.extravilan.cat ?? null, teren_extravilan_nota: L.extravilan.note ?? null,
    apartamente_eur_mp_util: { [L.ap_new.t]: by(L.ap_new), [L.ap_old.t]: by(L.ap_old) },
    spatii_comerciale_eur_mp_util: { [L.com_new.t]: by(L.com_new), [L.com_old.t]: (L.com_old.grup ?? {})[grup] ?? null },
    case_eur_mp_construit_desfasurat: { [L.casa_pe.t]: g(L.casa_pe), [L.casa_p.t]: g(L.casa_p), [L.casa_lemn.t]: g(L.casa_lemn) },
    anexe_eur_mp: { [L.anexa_car.t]: g(L.anexa_car), [L.anexa_lemn.t]: g(L.anexa_lemn), [L.grajd.t]: g(L.grajd), [L.magazie.t]: g(L.magazie) },
    garaje_parcari: L.garaj.rows, hoteluri_eur_mp_desfasurat: g(L.hotel), pensiuni_eur_mp_desfasurat: g(L.pensiune),
    industrial_eur_mp_desfasurat: Object.fromEntries(((L.industrial.rows as string[]) ?? []).map((n, i) => [n, cols(L.industrial.cols, ind[i])])),
    reguli: [L.note],
  };
}
/** The notarial grid at a point of a UAT with a grid: the zone, the street it was taken from and every value. */
async function grilaAt(req: Request, key: string, ll: [number, number]) {
  if (!GR_UATS.has(key)) return null;
  const [d, V] = await Promise.all([layer<GrData>(req, `grila-${key}`), layer<GrValues>(req, "grila-valori")]);
  if (!d || !V) return null;
  const r = grAt(d, ll);
  if (!r.zone) return { zona: null, mesaj: `În afara străzilor zonate în studiu (terenul extravilan: ${key === "timisoara" ? "8 €/mp" : "valoarea pe hectar a localității"}).`, sursa: V.sursa };
  return {
    ...grValues(V, key, r.zone, r.loc),
    incadrare: r.street ? { strada: r.street.n, tronson: r.street.seg ?? null, parte: r.street.side === 1 ? "nr. impare" : r.street.side === 2 ? "nr. pare" : null, distanta_m: Math.round(r.dist ?? 0), estimat: (r.dist ?? 0) > 120 } : null,
    nota: "Valori minime notariale (euro), orientative; reducerile din studiu (suprafețe mari, drum, spații verzi, mansardă, subsol) nu sunt aplicate.",
  };
}

/* ---------- the parcel ---------- */

async function describe(req: Request, c: McpCtx, u: Uat, rec: Rec, opts: { geojson?: boolean }) {
  const ring = decodeRing(rec.z), g = contour(ring);
  const blds = (rec.b ?? []).map(([name, z]) => { const r = decodeRing(z), cg = contour(r); return { nume: name, suprafata_la_sol_mp: r2(planeArea(r)), centru: cg.centru, perimetru_m: cg.perimetru_m, contur: cg.pts.map((p) => ({ pct: p.pct, x: p.x, y: p.y, lat: p.lat, lng: p.lng })) }; })
    .sort((a, b) => +a.nume.slice(1) - +b.nume.slice(1));
  const sc = r2(blds.reduce((s, b) => s + b.suprafata_la_sol_mp, 0));
  const obs: string[] = [];
  if (rec.f?.includes("shared")) obs.push("Același contur are mai multe numere cadastrale în plan (posibilă dezmembrare sau alipire). Verifică în extrasul CF.");
  if (rec.o) obs.push("Parcela nu mai apare în ultimul export ANCPI primit; conturul e cel din planul anterior.");
  const [tim, grila] = await Promise.all([u.key === "timisoara" ? timisoaraInfo(req, g.ll) : null, grilaAt(req, u.key, g.ll)]);
  return {
    nr_cadastral: rec.id, localitate: u.name, judet: u.county ?? "Timiș", plan_cadastral_la: u.date ?? null,
    suprafata_mp: rec.a, perimetru_m: g.perimetru_m, nr_puncte: ring.length, centru: g.centru,
    inventar_coordonate: g.pts,
    constructii: blds, suprafata_construita_la_sol_mp: sc, pot_procent: rec.a ? r2((100 * sc) / rec.a) : null,
    vecini_inscrisi: rec.n, nr_topo_orientative: rec.t ?? [], observatii: obs,
    ...(tim ? { timisoara: tim } : {}), ...(grila ? { grila_notariala_2026: grila } : {}),
    linkuri: { localizator: `${c.app}/localizare#${u.key}-${rec.id}`, analiza_amplasament: `${c.app}/amplasament?uat=${u.key}&nr=${rec.id}`, google_maps: `https://www.google.com/maps/search/?api=1&query=${g.centru.lat},${g.centru.lng}` },
    nota: "Coordonatele Stereo 70 sunt cele din planul cadastral ANCPI; cele GPS sunt calculate (±1–3 m). Construcțiile (C1, C2…) sunt numerotate orientativ, după mărime. Orientativ: nu înlocuiește extrasul CF.",
    ...(opts.geojson ? { geojson: { type: "FeatureCollection", features: [geojson(ring, { nr_cadastral: rec.id, uat: u.name, suprafata_mp: rec.a }), ...blds.map((b, i) => geojson(decodeRing(rec.b![i][1]), { constructie: b.nume, suprafata_la_sol_mp: b.suprafata_la_sol_mp }))] } } : {}),
  };
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180));
/** The parcel under a point: candidates by centre and reach, then the exact contour (the newest, then the smallest when they overlap). */
async function parcelAt(req: Request, u: Uat, ll: [number, number], EN: [number, number]) {
  const cs = await centres(u.key, req);
  if (!cs) return null;
  const ids = Object.entries(cs).filter(([, v]) => dist(ll, [v[0], v[1]]) <= (v[3] ?? 400) + 5).map(([id]) => id);
  let best: Rec | null = null;
  for (const id of ids) for (const r of await records(req, u.key, id)) {
    if (!inRing(EN, decodeRing(r.z))) continue;
    if (!best || (best.o && !r.o) || (!!best.o === !!r.o && r.a < best.a)) best = r;
  }
  return best;
}
const inBb = (u: Uat, ll: [number, number]) => !!u.bb && ll[0] >= u.bb[0] && ll[0] <= u.bb[2] && ll[1] >= u.bb[1] && ll[1] <= u.bb[3];

/** A point (GPS or Stereo 70) → the parcel it falls in, in any plan of the locator; else what is known about the point. */
async function atPoint(req: Request, c: McpCtx, ll: [number, number], opts: { geojson?: boolean }) {
  const [E, N] = wgs84ToStereo70(ll[0], ll[1]);
  const list = (await uats(req)).filter((u) => inBb(u, ll));
  for (const u of list) {
    const r = await parcelAt(req, u, ll, [E, N]);
    if (r) return { punct: { lat: r6(ll[0]), lng: r6(ll[1]), stereo70: { x: r3(N), y: r3(E) } }, parcela: await describe(req, c, u, r, opts) };
  }
  const u = list[0];
  const [tim, grila] = await Promise.all([list.some((x) => x.key === "timisoara") ? timisoaraInfo(req, ll) : null, u && GR_UATS.has(u.key) ? grilaAt(req, u.key, ll) : null]);
  return {
    punct: { lat: r6(ll[0]), lng: r6(ll[1]), stereo70: { x: r3(N), y: r3(E) } }, parcela: null,
    mesaj: u ? `Punctul e în zona planului ${u.name}, dar nu cade pe un imobil înscris (drum, parcelă neînscrisă sau imobil foarte nou).` : "Punctul nu e în niciun plan cadastral din localizator (deocamdată planurile acoperă județul Timiș).",
    ...(tim ? { timisoara: tim } : {}), ...(grila ? { grila_notariala_2026: grila } : {}),
    linkuri: { localizator: `${c.app}/localizare`, analiza_amplasament: `${c.app}/amplasament?lat=${r6(ll[0])}&lng=${r6(ll[1])}`, google_maps: `https://www.google.com/maps/search/?api=1&query=${r6(ll[0])},${r6(ll[1])}` },
  };
}

/* ---------- arguments ---------- */

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : null; };
/** lat/lng, or Stereo 70 x (north) / y (east): a point as [lat, lng]; the Stereo pair is swapped when written the other way round. */
function pointArg(a: Record<string, unknown>): [number, number] | null {
  const lat = num(a.lat), lng = num(a.lng);
  if (lat != null && lng != null) {
    if (lat < 43 || lat > 48.5 || lng < 20 || lng > 30) throw new ToolError("Coordonatele GPS nu sunt în România (lat 43,5–48,4; lng 20,1–30).");
    return [lat, lng];
  }
  const x = num(a.x), y = num(a.y);
  if (x != null && y != null) {
    const ok = (ll: [number, number]) => ll[0] > 43.5 && ll[0] < 48.4 && ll[1] > 20.1 && ll[1] < 30;
    const a1 = stereo70ToWgs84(y, x), a2 = stereo70ToWgs84(x, y);
    if (ok(a1)) return a1;
    if (ok(a2)) return a2;
    throw new ToolError("Coordonatele Stereo 70 nu cad în România (X = nord ≈ 200.000–800.000, Y = est ≈ 100.000–900.000).");
  }
  return null;
}

/* ---------- the tools ---------- */

const NOTE_LOC = "Localitatea = UAT-ul din localizator (comuna pentru sate: Chișoda → Giroc, Urseni → Moșnița Nouă); vezi instrumentul „localitati”.";
export const TOOLS = [
  { name: "localitati", description: "Localitățile (UAT-urile) cu plan cadastral în localizatorul UVALO, pe județe: nume, număr de imobile și de construcții, data planului. Satele sunt în planul comunei (lista „sate”).",
    inputSchema: { type: "object", properties: { judet: { type: "string", description: "Doar județul dat (opțional)." } } } },
  { name: "parcela", description: `Fișa unui imobil după numărul cadastral (sau nr. CF; „-C1-U20” se reduce la parcelă): suprafața din plan, perimetrul, inventarul de coordonate (Stereo 70 X/Y și GPS, lungimile laturilor), centrul, construcțiile cu suprafața la sol și POT, vecinii înscriși, numerele topo, cartierul și zona de impozitare (Timișoara), zona și valorile minime din grila notarială 2026 (Timișoara și localitățile limitrofe), linkuri spre localizator și analiza amplasamentului. Fără localitate caută în toate planurile. ${NOTE_LOC}`,
    inputSchema: { type: "object", properties: { nr: { type: "string", description: "Numărul cadastral (ex. „405240”, „CF 259154-C1-U20”)." }, localitate: { type: "string", description: "Localitatea / UAT-ul (opțional; fără ea se caută în toate planurile)." }, geojson: { type: "boolean", description: "Adaugă conturul parcelei și construcțiile ca GeoJSON (WGS84)." } }, required: ["nr"] } },
  { name: "parcela_la_coordonate", description: "Imobilul din planul cadastral pe care cade un punct: GPS (lat, lng) sau Stereo 70 (x = nord, y = est). Întoarce aceeași fișă ca „parcela”; fără imobil înscris acolo, ce se știe despre punct (localitatea, cartierul / zona de impozitare în Timișoara, grila notarială).",
    inputSchema: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, x: { type: "number", description: "Stereo 70 X (nord), m" }, y: { type: "number", description: "Stereo 70 Y (est), m" }, geojson: { type: "boolean" } } } },
  { name: "parcela_la_adresa", description: "Geocodează o adresă (Google) și întoarce imobilul din planul cadastral pe care cade, ca „parcela_la_coordonate”. Adrese din județul Timiș, cu localitatea în text (ex. „Str. Circumvalațiunii 33, Timișoara”). Disponibil în planurile cu căutare Google.",
    inputSchema: { type: "object", properties: { adresa: { type: "string" }, geojson: { type: "boolean" } }, required: ["adresa"] } },
  { name: "grila_notariala", description: "Grila notarială 2026 (Studiul de piață CNP Timișoara, Romprice): zona și toate valorile minime (teren, apartamente, case, spații comerciale, industrial, anexe, garaje) la un punct GPS / Stereo 70, sau pentru o zonă dată a unei localități (Timișoara zonele 0–5; Dumbrăvița, Giroc, Chișoda, Ghiroda, Moșnița Nouă / Veche, Urseni, Șag, Săcălaz, Dudeștii Noi, Jimbolia zonele A–E). Fără zonă și fără punct: schema de zone a localității.",
    inputSchema: { type: "object", properties: { localitate: { type: "string" }, zona: { type: "string", description: "„2”, „A”…" }, lat: { type: "number" }, lng: { type: "number" }, x: { type: "number" }, y: { type: "number" } } } },
  { name: "conversie_coordonate", description: "Stereo 70 (x = nord, y = est, metri) ↔ WGS84 (lat, lng). Dă fie lat + lng, fie x + y.",
    inputSchema: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, x: { type: "number" }, y: { type: "number" } } } },
] as const;
export type ToolName = (typeof TOOLS)[number]["name"];

export async function mcpContext(modules: string[]): Promise<McpCtx> {
  return { modules, app: await origin() };
}

export async function callTool(req: Request, c: McpCtx, name: string, a: Record<string, unknown>): Promise<unknown> {
  if (!c.modules.includes("localizare")) throw new ToolError("Localizatorul cadastral nu este în planul firmei (sau e dezactivat temporar).");
  switch (name as ToolName) {
    case "localitati": {
      const j = str(a.judet).toLowerCase();
      const list = (await uats(req)).filter((u) => !j || (u.county ?? "Timiș").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === j.normalize("NFD").replace(/[̀-ͯ]/g, ""));
      const byKey = Object.fromEntries(list.map((u) => [u.key, u.name]));
      return {
        localitati: list.map((u) => ({ localitate: u.name, judet: u.county ?? "Timiș", cheie: u.key, imobile: u.n, constructii: u.b ?? null, plan_cadastral_la: u.date ?? null })),
        sate: Object.fromEntries(Object.entries(VILLAGES).filter(([, k]) => byKey[k]).map(([s, k]) => [s, byKey[k]])),
        nota: "Planurile vin din exporturile ANCPI (strat ImobileE3 + ConstructiiE3); imobilele foarte noi pot lipsi. Deocamdată doar județul Timiș.",
      };
    }
    case "parcela": {
      const nr = cadastralRoot(str(a.nr, 40));
      if (!nr) throw new ToolError("Numărul cadastral nu conține cifre.");
      const list = await uats(req), city = str(a.localitate);
      let u: Uat | undefined;
      if (city) {
        const key = uatOfName(list, city);
        u = list.find((x) => x.key === key);
        if (!u) throw new ToolError(`Localitatea „${city}” nu are plan în localizator. Vezi instrumentul „localitati”.`);
      } else {
        const hits: Uat[] = [];
        for (const x of list) if ((await centres(x.key, req))?.[nr]) hits.push(x);
        if (hits.length > 1) throw new ToolError(`Numărul ${nr} apare în ${hits.length} localități (${hits.slice(0, 12).map((h) => h.name).join(", ")}${hits.length > 12 ? "…" : ""}). Precizează localitatea.`);
        if (!hits.length) throw new ToolError(`Numărul ${nr} nu apare în niciun plan din localizator.`);
        u = hits[0];
      }
      const recs = await records(req, u.key, nr);
      if (!recs.length) throw new ToolError(`Numărul ${nr} nu apare în planul ${u.name}. Verifică UAT-ul sau numărul din extrasul CF; imobilele foarte noi pot lipsi.`);
      const [main, ...rest] = await Promise.all(recs.map((r) => describe(req, c, u!, r, { geojson: !!a.geojson })));
      return rest.length ? { ...main, contururi_alternative: rest, observatii: [...main.observatii, `Numărul apare pe ${recs.length} contururi în plan; cel de mai sus e primul.`] } : main;
    }
    case "parcela_la_coordonate": {
      const ll = pointArg(a);
      if (!ll) throw new ToolError("Dă lat + lng (WGS84) sau x + y (Stereo 70).");
      return atPoint(req, c, ll, { geojson: !!a.geojson });
    }
    case "parcela_la_adresa": {
      const q = str(a.adresa, 300);
      if (!q) throw new ToolError("Dă adresa.");
      if (!c.modules.includes("google_maps")) throw new ToolError("Căutarea după adresă (Google) nu este în planul firmei. Folosește „parcela_la_coordonate” cu coordonatele punctului.");
      const res = await geocode(q);
      if (!res?.length) throw new ToolError(`Adresa „${q}” nu a fost găsită. Scrie și localitatea (și județul).`);
      const p = res[0];
      return { adresa_gasita: p.label, ...(await atPoint(req, c, [p.lat, p.lng], { geojson: !!a.geojson })), ...(res.length > 1 ? { alte_potriviri: res.slice(1, 4).map((x) => x.label) } : {}) };
    }
    case "grila_notariala": {
      const ll = pointArg(a), city = str(a.localitate), zone = str(a.zona, 4).toUpperCase();
      const list = await uats(req);
      if (ll) {
        const u = list.find((x) => GR_UATS.has(x.key) && inBb(x, ll));
        if (!u) throw new ToolError("Punctul nu e într-o localitate cu grilă notarială în UVALO (Timișoara și localitățile limitrofe).");
        const g = await grilaAt(req, u.key, ll);
        return { punct: { lat: r6(ll[0]), lng: r6(ll[1]) }, localitate_plan: u.name, ...(g ?? {}) };
      }
      if (!city) throw new ToolError("Dă localitatea (și zona) sau un punct (lat + lng / x + y).");
      const locKey = Object.keys(GR_LOC).find((k) => GR_LOC[k].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === city.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
      const key = locKey && GR_UATS.has(locKey) ? locKey : uatOfName(list, city) ?? null;
      if (!key || !GR_UATS.has(key)) throw new ToolError(`„${city}” nu are grilă notarială în UVALO. Localități: ${Object.values(GR_LOC).join(", ")}.`);
      const [d, V] = await Promise.all([layer<GrData>(req, `grila-${key}`), layer<GrValues>(req, "grila-valori")]);
      if (!d || !V) throw new ToolError("Datele grilei nu sunt disponibile.");
      const loc = locKey && d.scheme[locKey] ? locKey : Object.keys(d.scheme)[0];
      if (!zone) return { localitate: GR_LOC[loc], zone: d.scheme, strazi_zonate: d.streets.filter((s) => s.loc === loc).length, sursa: V.sursa, mesaj: "Dă zona („zona”) sau un punct pentru valori." };
      const sch = d.scheme[loc] ?? "";
      if (!(sch.includes(zone[0]) || (sch.split("-").length === 2 && zone[0] >= sch.split("-")[0] && zone[0] <= sch.split("-")[1]))) throw new ToolError(`Zona „${zone}” nu există în ${GR_LOC[loc]} (zonele ${sch}).`);
      return grValues(V, key, zone, loc);
    }
    case "conversie_coordonate": {
      const ll = pointArg(a);
      if (!ll) throw new ToolError("Dă lat + lng sau x + y.");
      const [E, N] = wgs84ToStereo70(ll[0], ll[1]);
      return { wgs84: { lat: r6(ll[0]), lng: r6(ll[1]) }, stereo70: { x: r3(N), y: r3(E) }, nota: "Stereo 70: X = nord, Y = est (metri). Transformare Helmert cu 7 parametri, precizie ≈ 1 m." };
    }
    default:
      throw new ToolError(`Instrument necunoscut: ${name}.`);
  }
}
