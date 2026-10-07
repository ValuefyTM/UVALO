import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { OFFICE_READY } from "@/lib/access";

/** "Lucrez ca birou de evaluare": shows "Firma mea" in the menu. */
export async function PATCH(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  if (!OFFICE_READY) return err("Funcția de birou de evaluare va fi disponibilă în curând.", 403);
  const on = (await json(req)).on === true;
  await a.db.prepare("UPDATE users SET is_office = ? WHERE id = ?").bind(on ? 1 : 0, a.c.user.id).run();
  return NextResponse.json({ ok: true, on });
}
