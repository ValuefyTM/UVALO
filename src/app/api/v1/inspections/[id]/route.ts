import { cancelInspection, extInspection, fail, keyApi } from "@/lib/integration";

/** The inspection (by UVALO id or your `ref`): state, the sheet with answers, rooms, findings, signature, files. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const r = await extInspection(a.db, a.key, decodeURIComponent((await params).id));
  return r ? Response.json({ ok: true, inspection: r }) : fail("Inspecția nu există.", 404);
}

/** Cancels it (`?reason=`): it leaves the valuer's phone. Not once finished. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const r = await cancelInspection(a.db, a.key, decodeURIComponent((await params).id), (new URL(req.url).searchParams.get("reason") ?? "").slice(0, 300));
  return "error" in r ? fail(r.error ?? "Eroare.", r.status ?? 400) : Response.json(r);
}
