import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { track } from "@/lib/track";
import { setUserLimit } from "@/lib/tools";

/** The exception of one person to the daily AI limits (found by email); both values empty = back to the general limit. */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const email = str(b.email, 200).toLowerCase();
  const id = str(b.userId, 80);
  const u = id
    ? await a.db.prepare("SELECT id, email FROM users WHERE id = ?").bind(id).first<{ id: string; email: string }>()
    : email ? await a.db.prepare("SELECT id, email FROM users WHERE lower(email) = ?").bind(email).first<{ id: string; email: string }>() : null;
  if (!u) return err("Nu există un utilizator cu acest email.");
  await setUserLimit(a.db, a.c.user.id, u.id, { ai_text: b.ai_text, ai_plan: b.ai_plan });
  await track(a.db, a.c, "admin", "user_limit", u.email, { ai_text: b.ai_text ?? null, ai_plan: b.ai_plan ?? null });
  return NextResponse.json({ ok: true });
}
