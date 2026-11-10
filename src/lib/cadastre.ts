// Server-only: centre of a cadastral parcel from the locator plans (Timiș), for placing a property on a map.
// The centres are computed at build time (scripts/copy-localizare.mjs → /_localizare/c/<uat>.json).
import { locatorAsset } from "./locator";
import { COUNTY_CENTRES, normName, orient, ringArea } from "./stereo70";

export type Uat = { key: string; name: string; county?: string | null; n: number; v?: string | null; bb?: [number, number, number, number] | null; date?: string | null; b?: number };
/** id → [lat, lng, area (mp), reach (m: the farthest corner from the centre)]; older builds have only [lat, lng]. */
export type Centre = [number, number, number?, number?];
const cache = new Map<string, Promise<Record<string, Centre> | null>>();
let uatList: Promise<Uat[]> | null = null;

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-.]/g, " ").replace(/\s+/g, " ").trim();

/** Villages that belong to a commune whose plan is in the locator (the plans are per UAT). */
export const VILLAGES: Record<string, string> = {
  "mosnita veche": "mosnita-noua", urseni: "mosnita-noua", albina: "mosnita-noua", rudicica: "mosnita-noua",
  chisoda: "giroc", "giarmata vii": "ghiroda", cerneteaz: "giarmata",
  utvin: "sinmihaiu-roman", "sinmihaiu german": "sinmihaiu-roman", "sanmihaiu german": "sinmihaiu-roman", "sanmihaiu roman": "sinmihaiu-roman", sabranca: "sinmihaiu-roman",
  "bazosu nou": "bucovat", "bazosul nou": "bucovat", bucovat: "bucovat", "bazosu vechi": "recas",
  carani: "sinandrei", covaci: "sinandrei", sanandrei: "sinandrei",
  dinias: "peciu-nou", "sanmartinu sarbesc": "peciu-nou",
  ianova: "remetea-mare", "beregsau mare": "sacalaz", "beregsau mic": "sacalaz", hitias: "sacalaz", sacalaz: "sacalaz",
  "sannicolau mare": "sinnicolau-mare", sandra: "sandra", "sanpetru mare": "sinpetru-mare",
};

/** "259154-C1-U20" / "CF 259154-C1-U20" → "259154": the parcel number of an individual unit (at most its first 6 digits). */
export function cadastralRoot(v: string | null | undefined) {
  const m = (v ?? "").match(/(\d{1,})/);
  return m ? m[1].slice(0, 6) : null;
}

/** The UATs of the locator (key, name, parcels with a centre), from the data built with the app. */
export async function uats(req: Request) {
  uatList ??= locatorAsset("c/index.json", req).then((r) => (r ? (r.json() as Promise<Uat[]>) : [])).catch(() => []);
  const list = await uatList;
  // A failed first load (data not built yet, a hiccup) is not kept: the next request tries again.
  if (!list.length) uatList = null;
  return list;
}
/** The UAT of a locality name (a village → its commune's plan), or undefined. */
export const uatOfName = (list: Uat[], city: string) => {
  const c = norm(city);
  return c ? VILLAGES[c] ?? list.find((u) => norm(u.name) === c)?.key : undefined;
};

/** Parcel centres of one UAT; the last 10 UATs stay in memory (all 59 would not fit in a worker). */
export function centres(key: string, req: Request) {
  let p = cache.get(key);
  if (p) { cache.delete(key); cache.set(key, p); return p; }
  p = locatorAsset(`c/${key}.json`, req).then((r) => (r ? r.json().then((d) => (d as { p: Record<string, Centre> }).p) : null)).catch(() => null);
  cache.set(key, p);
  while (cache.size > 10) cache.delete(cache.keys().next().value!);
  return p;
}

export type Located = { nr: string; uat: string; lat: number; lng: number; match: "uat" | "search" } | { nr: string | null; error: string; candidates?: string[] };

/**
 * Centre of the parcel `nr` (cadastral or land book number; units "…-C1-U20" are reduced to their parcel). With the
 * locality, only its UAT is searched; without it (or for a locality without a plan) all the plans, and a number found in
 * more than one is reported as ambiguous.
 */
export async function locateParcel(req: Request, nrRaw: string, city?: string | null): Promise<Located> {
  const nr = cadastralRoot(nrRaw);
  if (!nr) return { nr: null, error: "Numărul cadastral nu conține cifre." };
  const list = await uats(req);
  const key = city ? uatOfName(list, city) : undefined;
  if (key) {
    const p = (await centres(key, req))?.[nr];
    const name = list.find((u) => u.key === key)?.name ?? key;
    return p ? { nr, uat: name, lat: p[0], lng: p[1], match: "uat" } : { nr, error: `Numărul ${nr} nu apare în planul ${name}.` };
  }
  const hits: { name: string; p: Centre }[] = [];
  for (const u of list) {
    const p = (await centres(u.key, req))?.[nr];
    if (p) hits.push({ name: u.name, p });
  }
  if (hits.length === 1) return { nr, uat: hits[0].name, lat: hits[0].p[0], lng: hits[0].p[1], match: "search" };
  if (hits.length > 1) return { nr, error: `Numărul ${nr} apare în mai multe UAT-uri; precizează localitatea.`, candidates: hits.map((h) => h.name) };
  return { nr, error: `Numărul ${nr} nu apare în planurile din localizator${city ? ` (localitatea ${city} nu are plan)` : ""}.` };
}

type DocRead = { tip_document?: unknown; nr_cadastral?: unknown; uat?: unknown; judet?: unknown; puncte?: { x: unknown; y: unknown }[]; puncte_estimate?: { x: unknown; y: unknown }[] };
export type DocPlace = {
  lat: number; lng: number; swap: boolean; estimated: boolean; area: number;
  uat: { key: string; name: string; county: string | null } | null; // the UAT of the locator where the parcel falls (or named by the document)
  inPlan: boolean; // the cadastral number is in that UAT's plan
};

/**
 * Where a plan / CF read with AI lies: its Stereo 70 points oriented (X/Y order) and converted to GPS, the locator UAT
 * (named in the document or containing the point) and whether its cadastral number is in that plan. null = no usable points.
 */
export async function placeDoc(req: Request, j: DocRead): Promise<DocPlace | null> {
  const est = !(j.puncte ?? []).length && (j.puncte_estimate ?? []).length > 2;
  const list = await uats(req).catch(() => [] as Uat[]);
  const named = list.find((u) => normName(u.name) === normName(j.uat) && (!j.judet || normName(u.county ?? "Timiș") === normName(j.judet)));
  const hint: [number, number] | null = named?.bb ? [(named.bb[0] + named.bb[2]) / 2, (named.bb[1] + named.bb[3]) / 2] : COUNTY_CENTRES[normName(j.judet)] ?? null;
  const isCF = /funciar|extras de carte/i.test(String(j.tip_document ?? ""));
  const o = orient(est ? j.puncte_estimate : j.puncte, hint, isCF);
  if (!o) return null;
  const [lat, lng] = o.ll;
  const inside = (u: Uat) => !!u.bb && lat >= u.bb[0] && lat <= u.bb[2] && lng >= u.bb[1] && lng <= u.bb[3];
  const u = named && inside(named) ? named : list.find(inside) ?? null;
  const nr = cadastralRoot(typeof j.nr_cadastral === "string" ? j.nr_cadastral : null);
  const inPlan = !!(u && nr && (await centres(u.key, req))?.[nr]);
  return { lat, lng, swap: o.swap, estimated: est, area: Math.round(ringArea(o.ring)), uat: u ? { key: u.key, name: u.name, county: u.county ?? "Timiș" } : null, inPlan };
}
