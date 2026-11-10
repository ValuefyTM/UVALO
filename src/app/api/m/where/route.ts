import { api } from "@/lib/api";
import { reverseGeocode } from "@/lib/gmaps";

/** Phone app: the address at the phone's location (new inspection "Sunt la proprietate"). Empty without a Google key. */
export async function GET(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const u = new URL(req.url), lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ address: null });
  return Response.json({ address: await reverseGeocode(lat, lng).catch(() => null) });
}
