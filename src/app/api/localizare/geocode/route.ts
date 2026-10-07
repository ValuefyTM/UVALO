import { locatorAccess } from "@/lib/locator";
import { geocode, hasGoogle } from "@/lib/gmaps";

/** Address search through Google (the key stays on the server), for paid plans. 204 otherwise: the page uses the free search. */
export async function GET(req: Request) {
  const a = await locatorAccess();
  if ("status" in a) return new Response(a.status === 401 ? "Autentifică-te din nou." : "Fără acces.", { status: a.status });
  if (!hasGoogle(a.c)) return new Response(null, { status: 204 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!q) return Response.json([]);
  const res = await geocode(q);
  if (!res) return new Response(null, { status: 204 });
  return Response.json(res, { headers: { "Cache-Control": "private, max-age=3600" } });
}
