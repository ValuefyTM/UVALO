import { api, err } from "@/lib/api";
import { getFiles } from "@/lib/db";
import { fileFor, removeFile } from "@/lib/insp";

/** A file of an inspection, only for those who have the inspection (owner, the one doing it, super-admins). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return a.res;
  const { id } = await params;
  const f = await fileFor(a.db, a.c, id);
  const bucket = await getFiles();
  if (!f || !bucket) return err("Fișierul nu există.", 404);
  const o = await bucket.get(f.r2_key);
  if (!o) return err("Fișierul nu mai există în stocare.", 404);
  const name = (f.name ?? "fisier").replace(/[^\w.\- ]+/g, "_");
  return new Response(o.body, { headers: {
    "Content-Type": o.httpMetadata?.contentType ?? "application/octet-stream", "Content-Disposition": `inline; filename="${name}"`,
    "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff",
  } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return a.res;
  const { id } = await params;
  const r = await removeFile(a.db, await getFiles(), a.c, id);
  return "error" in r ? err(r.error, 404) : Response.json(r);
}
