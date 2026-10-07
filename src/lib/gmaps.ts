// Server-only: Google Maps for the cadastral locator. The key lives in the worker's variables (GOOGLE_MAPS_KEY).
// Google is only for firms whose plan lists the "google_maps" module (paid plans, later); everyone else, and every
// firm while no plan has it, keeps the free maps (Esri satellite, OpenStreetMap) even when the key is set.
// Map Tiles API: a session per map type, valid about two weeks, kept in the worker's memory and renewed a day early.

type Session = { session: string; expiry: number };
export type GmapsConfig = { key: string; sat: string; hyb: string; road: string };

const TYPES = {
  sat: { mapType: "satellite" },
  hyb: { mapType: "satellite", layerTypes: ["layerRoadmap"] },
  road: { mapType: "roadmap" },
} as const;

const cache = new Map<string, Session>();

/** Whether this person's firm pays for Google maps (module "google_maps" in its plan). */
export const hasGoogle = (c: { org: { modules: string } | null }) => !!c.org?.modules.split(",").map((m) => m.trim()).includes("google_maps");
const key = () => process.env.GOOGLE_MAPS_KEY?.trim() || "";
// Calls from the worker carry the site as referrer, for keys restricted to tools.valuefy.ro.
const REFERER = { Referer: "https://tools.valuefy.ro/" };

async function session(k: string, t: keyof typeof TYPES) {
  const hit = cache.get(t);
  if (hit && hit.expiry * 1000 - Date.now() > 86_400_000) return hit.session;
  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(k)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...REFERER },
    body: JSON.stringify({ ...TYPES[t], language: "ro-RO", region: "RO" }),
  });
  if (!res.ok) throw new Error(`createSession ${t}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { session: string; expiry: string };
  cache.set(t, { session: j.session, expiry: Number(j.expiry) || Date.now() / 1000 + 86_400 * 7 });
  return j.session;
}

/** What the page needs for Google maps, or null (no key, or Google refused) so the page keeps the free maps. */
export async function gmapsConfig(): Promise<GmapsConfig | null> {
  const k = key();
  if (!k) return null;
  try {
    const [sat, hyb, road] = await Promise.all([session(k, "sat"), session(k, "hyb"), session(k, "road")]);
    return { key: k, sat, hyb, road };
  } catch (e) {
    console.error("Google Maps:", e);
    return null;
  }
}

export type Place = { lat: number; lng: number; label: string };

/** Address → places in Timiș and around (Geocoding API). Null when there is no key or Google refused. */
export async function geocode(q: string): Promise<Place[] | null> {
  const k = key();
  if (!k) return null;
  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", q);
  u.searchParams.set("key", k);
  u.searchParams.set("language", "ro");
  u.searchParams.set("region", "ro");
  u.searchParams.set("bounds", "45.2,20.2|46.3,22.7");
  u.searchParams.set("components", "country:RO");
  const res = await fetch(u, { headers: REFERER });
  if (!res.ok) return null;
  const j = (await res.json()) as { status: string; error_message?: string; results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
  if (j.status !== "OK" && j.status !== "ZERO_RESULTS") { console.error("Geocoding:", j.status, j.error_message); return null; }
  return (j.results ?? []).slice(0, 6).map((r) => ({
    lat: r.geometry.location.lat, lng: r.geometry.location.lng,
    label: r.formatted_address.replace(/, (România|Romania)$/, "").replace(/ \d{6}(?=,|$)/, ""),
  }));
}
