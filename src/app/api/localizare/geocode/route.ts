import { locatorAccess } from "@/lib/locator";
import { geocode } from "@/lib/gmaps";

/** Address search for the locator, through Google (the key stays on the server). 204 when Google is not set up. */
export async function GET(req: Request) {
  const a = await locatorAccess();
  if ("status" in a) return new Response(a.status === 401 ? "Autentifică-te din nou." : "Fără acces.", { status: a.status });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!q) return Response.json([]);
  const res = await geocode(q);
  if (!res) return new Response(null, { status: 204 });
  return Response.json(res, { headers: { "Cache-Control": "private, max-age=3600" } });
}
