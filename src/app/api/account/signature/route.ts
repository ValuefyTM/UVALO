import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";

/** The person's signature for the inspection sheets: a PNG data URL (transparent background, drawn or uploaded), or null to remove it. */
export async function PATCH(req: Request) {
  const a = await api("user", { maint: true });
  if ("res" in a) return a.res;
  const v = (await json(req)).signature;
  if (v !== null && (typeof v !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > 160_000)) return err("Semnătura nu este validă sau este prea mare.");
  await a.db.prepare("UPDATE users SET signature = ? WHERE id = ?").bind(v, a.c.user.id).run();
  return NextResponse.json({ ok: true });
}
