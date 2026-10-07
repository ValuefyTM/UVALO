import { locatorAccess, locatorAsset } from "@/lib/locator";

/** PDF / Word / PNG export and multiple search of the locator (localizare-data/export.js). */
export async function GET(req: Request) {
  const a = await locatorAccess();
  if ("status" in a) return new Response("// fără acces", { status: a.status, headers: { "Content-Type": "text/javascript" } });
  const file = await locatorAsset("export.js", req);
  if (!file) return new Response("// indisponibil", { status: 404, headers: { "Content-Type": "text/javascript" } });
  return new Response(await file.text(), { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "private, no-cache" } });
}
