import { api } from "@/lib/api";
import { cadastralRoot, centres, uatOfName, uats } from "@/lib/cadastre";

/**
 * Phone app → detail of an inspection: is its cadastral number in a plan of the locator? The UAT is the one named in the inspection,
 * else the plans whose area holds the inspection's position. { key, nr } → the button „Vezi în localizator” (/localizare#key-nr), else null.
 */
export async function GET(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const { c } = a;
  if (!c.modules.includes("localizare")) return Response.json({ found: null });
  const u = new URL(req.url);
  const nr = cadastralRoot(u.searchParams.get("nr"));
  if (!nr) return Response.json({ found: null });
  const list = await uats(req);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const named = uatOfName(list, u.searchParams.get("uat") ?? "");
  const near = Number.isFinite(lat) && Number.isFinite(lng) && u.searchParams.get("lat")
    ? list.filter((x) => x.bb && lat >= x.bb[0] - 0.01 && lat <= x.bb[2] + 0.01 && lng >= x.bb[1] - 0.01 && lng <= x.bb[3] + 0.01).map((x) => x.key) : [];
  for (const key of [...new Set([named, ...near].filter(Boolean) as string[])]) {
    if ((await centres(key, req))?.[nr]) return Response.json({ found: { key, nr } }, { headers: { "Cache-Control": "private, max-age=3600" } });
  }
  return Response.json({ found: null }, { headers: { "Cache-Control": "private, max-age=600" } });
}
