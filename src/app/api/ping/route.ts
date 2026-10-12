import { cookies } from "next/headers";
import { getDb, now } from "@/lib/db";
import { COOKIE } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";

/** Presence signal from public/presence.js (once a minute while a page is visible): the session's last activity and page. */
export async function POST(req: Request) {
  const token = (await cookies()).get(COOKIE)?.value;
  const db = await getDb();
  if (!token || !db) return new Response(null, { status: 204 });
  const b = (await req.json().catch(() => ({}))) as { page?: unknown };
  const page = typeof b.page === "string" ? b.page.slice(0, 200) : null;
  const t = now();
  const s = await db.prepare("UPDATE sessions SET last_seen_at = ?, last_page = ? WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? RETURNING user_id")
    .bind(t, page, await sha256(token), t).first<{ user_id: string }>();
  if (s) await db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(t, s.user_id).run();
  return new Response(null, { status: 204 });
}
