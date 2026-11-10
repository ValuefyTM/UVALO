import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { saveOffice } from "@/lib/office";
import { track } from "@/lib/track";

/** Activates "Birou de evaluare" with the office details, or saves them (accounts it was turned on for, in test). */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const r = await saveOffice(a.db, a.c, await json(req));
  if ("error" in r) return err(r.error, r.error.includes("testare") ? 403 : 400);
  if (r.first) await track(a.db, a.c, "office", "activate", r.org_id);
  return NextResponse.json(r);
}

/** `{ on: false }`: turns the office function off ("Firma mea" leaves the menu; the firm and its people stay). */
export async function PATCH(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  if (!a.c.office) return err("Funcția de birou este în testare.", 403);
  const on = (await json(req)).on === true;
  await a.db.prepare("UPDATE users SET is_office = ? WHERE id = ?").bind(on ? 1 : 0, a.c.user.id).run();
  return NextResponse.json({ ok: true, on });
}
