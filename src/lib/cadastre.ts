// Server-only: centre of a cadastral parcel from the locator plans (Timiș), for placing a property on a map.
// The centres are computed at build time (scripts/copy-localizare.mjs → /_localizare/c/<uat>.json).
import { locatorAsset } from "./locator";

type Uat = { key: string; name: string; county?: string | null; n: number };
const cache = new Map<string, Promise<Record<string, [number, number]> | null>>();
let uatList: Promise<Uat[]> | null = null;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-.]/g, " ").replace(/\s+/g, " ").trim();

/** Villages that belong to a commune whose plan is in the locator (the plans are per UAT). */
const VILLAGES: Record<string, string> = {
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
/** Parcel centres of one UAT; the last 10 UATs stay in memory (all 59 would not fit in a worker). */
function centres(key: string, req: Request) {
  let p = cache.get(key);
  if (p) { cache.delete(key); cache.set(key, p); return p; }
  p = locatorAsset(`c/${key}.json`, req).then((r) => (r ? r.json().then((d) => (d as { p: Record<string, [number, number]> }).p) : null)).catch(() => null);
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
  const c = city ? norm(city) : "";
  const key = c ? VILLAGES[c] ?? list.find((u) => norm(u.name) === c)?.key : undefined;
  if (key) {
    const p = (await centres(key, req))?.[nr];
    const name = list.find((u) => u.key === key)?.name ?? key;
    return p ? { nr, uat: name, lat: p[0], lng: p[1], match: "uat" } : { nr, error: `Numărul ${nr} nu apare în planul ${name}.` };
  }
  const hits: { name: string; p: [number, number] }[] = [];
  for (const u of list) {
    const p = (await centres(u.key, req))?.[nr];
    if (p) hits.push({ name: u.name, p });
  }
  if (hits.length === 1) return { nr, uat: hits[0].name, lat: hits[0].p[0], lng: hits[0].p[1], match: "search" };
  if (hits.length > 1) return { nr, error: `Numărul ${nr} apare în mai multe UAT-uri; precizează localitatea.`, candidates: hits.map((h) => h.name) };
  return { nr, error: `Numărul ${nr} nu apare în planurile din localizator${city ? ` (localitatea ${city} nu are plan)` : ""}.` };
}
