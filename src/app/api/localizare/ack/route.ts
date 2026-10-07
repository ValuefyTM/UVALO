import { NextResponse } from "next/server";
import { now } from "@/lib/db";
import { locatorAccess } from "@/lib/locator";
import { track } from "@/lib/track";

/** "Am luat la cunoștință" on the locator notice: kept on the account, so it is shown only once. */
export async function POST() {
  const a = await locatorAccess();
  if ("status" in a) return NextResponse.json({ error: "Fără acces." }, { status: a.status });
  await a.db.prepare("UPDATE users SET loc_ack_at = COALESCE(loc_ack_at, ?) WHERE id = ?").bind(now(), a.c.user.id).run();
  await track(a.db, a.c, "localizare", "notice_ack");
  return NextResponse.json({ ok: true });
}
