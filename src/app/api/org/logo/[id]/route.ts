import { getDb } from "@/lib/db";
import { currentSession } from "@/lib/auth";

/** An office's logo (signed-in users only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  if (!db || !(await currentSession(db))) return new Response(null, { status: 401 });
  const r = await db.prepare("SELECT logo FROM orgs WHERE id = ?").bind((await params).id).first<{ logo: string | null }>();
  const m = r?.logo?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return new Response(null, { status: 404 });
  const bin = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  return new Response(bin, { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=300" } });
}
