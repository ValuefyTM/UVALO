import { NextResponse } from "next/server";
import { api, err } from "@/lib/api";
import { locateParcel, uats } from "@/lib/cadastre";
import { reverseGeocode } from "@/lib/gmaps";

/**
 * Inspecție nouă: a cadastral number (+ locality) → the parcel's centre from the locator plans, its UAT / county and the street
 * address from reverse geocoding (Google; without a key the locality). Used by the form to prefill the property and show the map.
 */
export async function GET(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  if (!a.c.modules.includes("inspectii") && !a.c.modules.includes("localizare")) return err("Nu ai acces la localizator.", 403);
  const u = new URL(req.url);
  const nr = (u.searchParams.get("nr") ?? "").trim(), city = (u.searchParams.get("uat") ?? "").trim() || null;
  if (!nr) return err("Lipsește numărul cadastral.");
  const r = await locateParcel(req, nr, city);
  if ("error" in r) return NextResponse.json({ found: false, nr: r.nr, error: r.error, candidates: r.candidates ?? [] });
  const list = await uats(req).catch(() => []);
  const county = list.find((x) => x.name === r.uat)?.county ?? "Timiș";
  const address = (await reverseGeocode(r.lat, r.lng).catch(() => null)) ?? `${r.uat}, jud. ${county}`;
  const key = list.find((x) => x.name === r.uat)?.key;
  return NextResponse.json({ found: true, nr: r.nr, uat: r.uat, county, lat: r.lat, lng: r.lng, address, link: key ? `/localizare?uat=${encodeURIComponent(key)}&q=${encodeURIComponent(r.nr)}` : null });
}
