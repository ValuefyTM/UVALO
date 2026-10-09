import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { setMaintenance } from "@/lib/maintenance";
import { track } from "@/lib/track";

/** Turns maintenance mode on or off (UVALO administrators keep access either way). */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  if (typeof b.on !== "boolean") return err("Alege dacă pornești sau oprești mentenanța.");
  const m = await setMaintenance(a.db, a.c.user.id, { on: b.on, message: str(b.message, 300) });
  await track(a.db, a.c, "admin", m.on ? "maintenance_on" : "maintenance_off", null, { message: m.message });
  return NextResponse.json({ ok: true, ...m });
}
