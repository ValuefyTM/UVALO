import { getDb, getFiles } from "@/lib/db";

/**
 * The pictures of a shared inspection sheet (/fisa/<token>), without an account: its photos (only kind = photo of that
 * inspection; never the documents or the signature) and, as "logo", the logo of the firm it belongs to.
 * The link stops working as soon as sharing is turned off (the token is removed).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  const db = await getDb();
  if (!db || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new Response(null, { status: 404 });
  const insp = await db.prepare("SELECT id, org_id FROM inspections WHERE share_token = ? AND deleted_at IS NULL").bind(token).first<{ id: string; org_id: string | null }>();
  if (!insp) return new Response(null, { status: 404 });
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
