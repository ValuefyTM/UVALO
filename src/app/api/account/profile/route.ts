import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";

export async function PATCH(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  const name = str(b.name, 120);
  if (name.length < 3) return err("Completează numele și prenumele.");
  await a.db.prepare("UPDATE users SET name = ?, phone = ?, anevar_no = ? WHERE id = ?").bind(name, str(b.phone, 40) || null, str(b.anevar, 40) || null, a.c.user.id).run();
  return NextResponse.json({ ok: true });
}
