import { cancelInspection, extInspection, fail, keyApi } from "@/lib/integration";

/** The inspection (by UVALO id or your `ref`): state, the sheet with answers, rooms, findings, signature, files. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const r = await extInspection(a.db, a.key, decodeURIComponent((await params).id));
  return r ? Response.json({ ok: true, inspection: r }) : fail("Inspecția nu există.", 404);
}

/** Cancels it (`?reason=`): it leaves the valuer's phone. Once finished only with `?force=1` (deleted with its sheet). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const u = new URL(req.url);
  const r = await cancelInspection(a.db, a.key, decodeURIComponent((await params).id), (u.searchParams.get("reason") ?? "").slice(0, 300), u.searchParams.get("force") === "1");
  return "error" in r ? fail(r.error ?? "Eroare.", r.status ?? 400) : Response.json(r);
}
