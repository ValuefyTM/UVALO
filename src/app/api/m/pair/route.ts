import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { createSession, handoffLink } from "@/lib/auth";
import { err, json, str } from "@/lib/api";
import { registerDevice, usePairCode } from "@/lib/insp";

/** Phone app: sign in with the code / QR shown on the web (Inspecții → activare). The phone is recorded as connected. */
export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return err("Serviciul nu este disponibil momentan.", 503);
  const b = await json(req);
  // the QR's token (long) or the 8-digit code typed by hand; wrong ones are limited (usePairCode)
  const p = await usePairCode(db, str(b.code, 80));
  if ("error" in p) return err(p.error, 401);
  const userId = p.userId;
  const cookie = await createSession(db, userId);
  const s = await db.prepare("SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(userId).first<{ id: string }>();
  if (s) await registerDevice(db, userId, s.id, (await headers()).get("user-agent") ?? "", !!b.standalone);
  // `go`: the app opens it at once, so the cookie is also set by a page load (handoffLink: installed apps may drop the request's cookie)
  const email = (await db.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string }>())?.email;
  const res = NextResponse.json({ ok: true, go: email ? await handoffLink(db, email, "/") : null });
  res.cookies.set(cookie);
  return res;
}
