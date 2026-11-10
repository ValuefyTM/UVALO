import { extDeleteFile, fail, keyApi } from "@/lib/integration";

/** Takes back a document given to the valuer (CF, releveu, other document): DELETE …/inspections/<id or ref>/files/<file id>. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const p = await params;
  const r = await extDeleteFile(a.db, a.key, decodeURIComponent(p.id), decodeURIComponent(p.file));
  return "error" in r ? fail(r.error ?? "Eroare.", r.status ?? 400) : Response.json(r);
}
