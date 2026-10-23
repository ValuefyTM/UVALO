import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession, handoffLink, verifyCode } from "@/lib/auth";
import { err, json, str } from "@/lib/api";

/** Step 2 of sign-in: email + 6-digit code → session cookie. */
export async function POST(req: Request) {
  const b = await json(req);
  const db = await getDb();
  if (!db) return err("Serviciul nu este disponibil momentan.", 503);
  const u = await verifyCode(db, str(b.email, 160), str(b.code, 12));
  if (u && "error" in u) return err(u.error, 429);
  if (!u) return err("Codul nu este corect sau a expirat. Verifică emailul sau cere un cod nou.", 401);
  // `go`: the page opens it at once, so the cookie is also set by a page load (see handoffLink)
  const n = str(b.next, 300), next = /^\/(?![/\\])[^\s\\]*$/.test(n) ? n : "/";
  const res = NextResponse.json({ ok: true, go: await handoffLink(db, u.email, next) });
  res.cookies.set(await createSession(db, u.id));
  return res;
}
