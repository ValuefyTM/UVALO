import { NextResponse } from "next/server";
import { maintenance } from "@/lib/maintenance";
import { getDb } from "@/lib/db";
import { acceptInvite, createSession } from "@/lib/auth";
import { err, json, str } from "@/lib/api";
import { cleanPhone } from "@/lib/crypto";

/** Accepting an invitation: name, phone (required), terms → active account, signed in. */
export async function POST(req: Request) {
  const b = await json(req);
  const name = str(b.name, 120);
  if (name.length < 3) return err("Completează numele și prenumele.");
  const phone = cleanPhone(b.phone);
  if (!phone) return err("Completează un număr de telefon valid (ex. 0722 123 456).");
  if (b.terms !== true) return err("Pentru a continua, acceptă termenii de utilizare.");
  const db = await getDb();
  if (!db) return err("Serviciul nu este disponibil momentan.", 503);
  if ((await maintenance(db)).on) return err("Platforma este în mentenanță. Revenim în curând.", 503);
  const u = await acceptInvite(db, str(b.token, 200), name, phone, str(b.anevar, 40) || null);
  if (!u) return err("Invitația a expirat sau a fost deja folosită. Cere o invitație nouă.", 410);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(await createSession(db, u.id));
  return res;
}
