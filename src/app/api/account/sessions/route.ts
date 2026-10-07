import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { now } from "@/lib/db";
import { revokeSessions } from "@/lib/auth";

/** Closes one of my sessions (`?id=`) or all the others (`?all=1`). */
export async function DELETE(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const q = new URL(req.url).searchParams;
  if (q.get("all")) await revokeSessions(a.db, a.c.user.id, a.c.session.id);
  else await a.db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ?").bind(now(), q.get("id") ?? "", a.c.user.id).run();
  return NextResponse.json({ ok: true });
}
