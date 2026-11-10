import { extAddFile, fail, keyApi } from "@/lib/integration";

/** A document for the valuer: multipart `file` + `kind` (cf | releveu | doc) + `name?`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Lipsește fișierul.");
  const r = await extAddFile(a.db, a.key, decodeURIComponent((await params).id), file, String(form?.get("kind") ?? "doc"), String(form?.get("name") ?? ""));
  return "error" in r ? fail(r.error ?? "Eroare.", r.status ?? 400) : Response.json(r, { status: 201 });
}
