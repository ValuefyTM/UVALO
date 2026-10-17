import { getFiles } from "@/lib/db";
import { extFile, fail, keyApi } from "@/lib/integration";

/** A file of one of the firm's inspections (photo, signature, document). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const f = await extFile(a.db, a.key, (await params).id);
  const bucket = await getFiles();
  const obj = f && bucket ? await bucket.get(f.r2_key) : null;
  if (!f || !obj) return fail("Fișierul nu există.", 404);
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${encodeURIComponent(f.name ?? f.id)}"` } });
}
