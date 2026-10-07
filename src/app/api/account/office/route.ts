import { NextResponse } from "next/server";
import { api, json } from "@/lib/api";

/** "Lucrez ca birou de evaluare": shows "Firma mea" in the menu. */
export async function PATCH(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const on = (await json(req)).on === true;
  await a.db.prepare("UPDATE users SET is_office = ? WHERE id = ?").bind(on ? 1 : 0, a.c.user.id).run();
  return NextResponse.json({ ok: true, on });
}
