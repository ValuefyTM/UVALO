import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession, verifyCode } from "@/lib/auth";
import { err, json, str } from "@/lib/api";

/** Step 2 of sign-in: email + 6-digit code → session cookie. */
export async function POST(req: Request) {
  const b = await json(req);
  const db = await getDb();
  if (!db) return err("Serviciul nu este disponibil momentan.", 503);
  const u = await verifyCode(db, str(b.email, 160), str(b.code, 12));
  if (!u) return err("Codul nu este corect sau a expirat. Verifică emailul sau cere un cod nou.", 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(await createSession(db, u.id));
  return res;
}
