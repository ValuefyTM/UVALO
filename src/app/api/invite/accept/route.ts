import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { acceptInvite, createSession } from "@/lib/auth";
import { err, json, str } from "@/lib/api";

/** Accepting an invitation: name, phone, terms → active account, signed in. */
export async function POST(req: Request) {
  const b = await json(req);
  const name = str(b.name, 120);
  if (name.length < 3) return err("Completează numele și prenumele.");
  if (b.terms !== true) return err("Pentru a continua, acceptă termenii de utilizare.");
  const db = await getDb();
  if (!db) return err("Serviciul nu este disponibil momentan.", 503);
  const u = await acceptInvite(db, str(b.token, 200), name, str(b.phone, 40) || null, str(b.anevar, 40) || null);
  if (!u) return err("Invitația a expirat sau a fost deja folosită. Cere o invitație nouă.", 410);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(await createSession(db, u.id));
  return res;
}
