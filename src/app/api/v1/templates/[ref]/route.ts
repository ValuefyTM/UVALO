import { deleteTemplate, fail, keyApi, putTemplate } from "@/lib/integration";

/** Creates / replaces the firm's sheet with your id `ref`: `{ name, prop_type, template: {groups, rooms?}, enforced? }` (published at once). */
export async function PUT(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = await putTemplate(a.db, a.key, decodeURIComponent((await params).ref), b);
  return "error" in r ? fail(r.error ?? "Eroare.") : Response.json(r);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const r = await deleteTemplate(a.db, a.key, decodeURIComponent((await params).ref));
  return "error" in r ? fail(r.error ?? "Eroare.", 404) : Response.json(r);
}
