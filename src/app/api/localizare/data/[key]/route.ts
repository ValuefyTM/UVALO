import { locatorAccess, locatorAsset } from "@/lib/locator";

/** Cadastral plan of one locality, for the /localizare map. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const a = await locatorAccess();
  if ("status" in a) return new Response(a.status === 401 ? "Autentifică-te din nou." : "Fără acces.", { status: a.status });
  const { key } = await params;
  if (!/^[a-z-]{2,40}$/.test(key)) return new Response("Nu există.", { status: 404 });
  const file = await locatorAsset(`${key}.json`, req);
  if (!file) return new Response("Nu există.", { status: 404 });
  const headers = new Headers(file.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "private, max-age=86400");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(file.body, { headers });
}
