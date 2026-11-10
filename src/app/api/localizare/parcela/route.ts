import { locatorAccess } from "@/lib/locator";
import { origin } from "@/lib/site";
import { parcelForApp, ToolError } from "@/lib/mcp-localizare";

/**
 * A cadastral parcel with everything a site analysis needs (for other apps — the external CRM): the contour and the
 * coordinates inventory, the buildings and POT, the registered neighbours with their contours, the Timișoara layers and the
 * 2026 notarial grid, as GeoJSON too.
 * GET ?nr=<cadastral number>&city=<locality>  or  ?lat=&lng=   [&vecini=0]
 * Auth: `Authorization: Bearer <LOCATOR_API_TOKEN>` (as /api/localizare/centroid), or a signed-in user of the locator.
 */
async function allowed(req: Request) {
  const token = process.env.LOCATOR_API_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  if (token && auth.startsWith("Bearer ")) {
    const a = new TextEncoder().encode(auth.slice(7)), b = new TextEncoder().encode(token);
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
  }
  return !("status" in (await locatorAccess()));
}

export async function GET(req: Request) {
  if (!(await allowed(req))) return Response.json({ error: "Fără acces." }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const num = (k: string) => { const v = parseFloat((u.get(k) ?? "").replace(",", ".")); return Number.isFinite(v) ? v : null; };
  try {
    const r = await parcelForApp(req, await origin(), { nr: u.get("nr") ?? "", city: u.get("city") ?? "", lat: num("lat"), lng: num("lng"), neighbours: u.get("vecini") !== "0" });
    return Response.json(r, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    if (e instanceof ToolError) return Response.json({ error: e.message }, { status: 404 });
    console.error("parcela api", e);
    return Response.json({ error: "Eroare la citirea planului." }, { status: 500 });
  }
}
