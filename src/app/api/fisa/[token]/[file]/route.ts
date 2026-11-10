import { getDb, getFiles } from "@/lib/db";
import { sharedInspection } from "@/lib/insp";
import { sheetPdf, sheetPdfName } from "@/lib/insp-pdf";

/**
 * The pictures of a shared inspection sheet (/fisa/<token>), without an account: its photos (only kind = photo of that
 * inspection; never the documents or the signature), as "logo" the logo of the firm it belongs to, and as "pdf" the
 * public sheet as a PDF file (the same content as the page). The link stops working as soon as sharing is turned off.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  const db = await getDb();
  if (!db || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new Response(null, { status: 404 });
  const insp = await db.prepare("SELECT id, org_id FROM inspections WHERE share_token = ? AND deleted_at IS NULL").bind(token).first<{ id: string; org_id: string | null }>();
  if (!insp) return new Response(null, { status: 404 });
  if (file === "pdf") {
    const x = await sharedInspection(db, token);
    if (!x) return new Response(null, { status: 404 });
    const firm = x.org_id ? await db.prepare("SELECT name, corp_no, logo, office_at FROM orgs WHERE id = ?").bind(x.org_id).first<{ name: string; corp_no: string | null; logo: string | null; office_at: string | null }>() : null;
    // only the photos (never the documents or the signature) reach the public PDF
    const keys = new Map((await db.prepare("SELECT id, r2_key FROM insp_files WHERE inspection_id = ? AND kind = 'photo'").bind(x.id).all<{ id: string; r2_key: string | null }>()).results.map((f) => [f.id, f.r2_key]));
    const bucket = await getFiles();
    const bytes = await sheetPdf(x, { firm: firm ?? null, pub: true, origin: new URL(req.url).origin, file: async (fid) => {
      const k = keys.get(fid);
      const o = k && bucket ? await bucket.get(k) : null;
      return o ? new Uint8Array(await o.arrayBuffer()) : null;
    } });
    return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${sheetPdfName(x)}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex",
    } });
  }
  if (file === "logo") {
    const r = insp.org_id ? await db.prepare("SELECT logo FROM orgs WHERE id = ?").bind(insp.org_id).first<{ logo: string | null }>() : null;
    const m = r?.logo?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!m) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0)), { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=300" } });
  }
  const f = await db.prepare("SELECT r2_key FROM insp_files WHERE id = ? AND inspection_id = ? AND kind = 'photo'").bind(file, insp.id).first<{ r2_key: string }>();
  const bucket = await getFiles();
  if (!f || !bucket) return new Response(null, { status: 404 });
  const o = await bucket.get(f.r2_key);
  if (!o) return new Response(null, { status: 404 });
  return new Response(o.body, { headers: {
    "Content-Type": o.httpMetadata?.contentType ?? "image/jpeg", "Cache-Control": "public, max-age=600", "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  } });
}
