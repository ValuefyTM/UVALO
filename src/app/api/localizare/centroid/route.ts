import { locatorAccess } from "@/lib/locator";
import { locateParcel } from "@/lib/cadastre";

/**
 * Centre (GPS) of a cadastral parcel, for placing a property on a map.
 * GET ?nr=<cadastral or CF number>&city=<locality>  →  { nr, uat, lat, lng, match } or { nr, error }
 * POST { items: [{ id, nr, city }] } (up to 200)    →  { results: [{ id, …same }] }
 * For other VALUEFY apps (the CRM): `Authorization: Bearer <LOCATOR_API_TOKEN>`; otherwise a signed-in user of the locator.
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
  const u = new URL(req.url);
  const r = await locateParcel(req, u.searchParams.get("nr") ?? "", u.searchParams.get("city"));
  return Response.json(r, { status: "error" in r ? 404 : 200, headers: { "Cache-Control": "private, max-age=86400" } });
}

export async function POST(req: Request) {
  if (!(await allowed(req))) return Response.json({ error: "Fără acces." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { items?: { id?: unknown; nr?: unknown; city?: unknown }[] };
  const items = Array.isArray(b.items) ? b.items.slice(0, 200) : [];
  const results = [];
  for (const it of items) {
    results.push({ id: it.id ?? null, ...(await locateParcel(req, String(it.nr ?? ""), typeof it.city === "string" ? it.city : null)) });
  }
  return Response.json({ results });
}
