import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";

/** Profile picture: a small JPEG / PNG / WebP data URL (resized on the device), or null to remove it. */
export async function PATCH(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const v = (await json(req)).avatar;
  if (v !== null && (typeof v !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > 200_000)) return err("Imaginea nu este validă sau este prea mare.");
  await a.db.prepare("UPDATE users SET avatar = ? WHERE id = ?").bind(v, a.c.user.id).run();
  return NextResponse.json({ ok: true });
}
