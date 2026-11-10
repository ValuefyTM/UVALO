import { extNotify, fail, keyApi } from "@/lib/integration";

/** Tells the valuer something about the inspection (phone notification + history): `{ title?: "docs" | "info", text }`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = await extNotify(a.db, a.key, decodeURIComponent((await params).id), b);
  return "error" in r ? fail(r.error ?? "Eroare.", r.status ?? 400) : Response.json(r);
}
