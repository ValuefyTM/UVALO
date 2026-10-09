import { api, json } from "@/lib/api";
import { track } from "@/lib/track";

/** "Anunță-mă" on the home page: the person wants an email when an upcoming module opens. */
const SOON = new Set(["analize", "colaborari"]);

export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  const key = typeof b.key === "string" && SOON.has(b.key) ? b.key : null;
  if (!key) return Response.json({ ok: false }, { status: 400 });
  const had = await a.db.prepare("SELECT 1 FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify' AND target = ? LIMIT 1").bind(a.c.user.id, key).first();
  if (!had) await track(a.db, a.c, "home", "notify", key);
  return Response.json({ ok: true });
}
