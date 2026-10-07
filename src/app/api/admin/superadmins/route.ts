import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { invite } from "@/lib/auth";
import { validEmail } from "@/lib/crypto";

/** Invites a VALUEFY administrator (sees and manages every firm). */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const email = str(b.email, 160);
  if (!validEmail(email)) return err("Adresa de email nu pare validă.");
  const r = await invite(a.db, a.c.user, null, email, "member", str(b.name, 120));
  return NextResponse.json({ ok: true, sent: r.sent });
}
