import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { track } from "@/lib/track";
import { FEATURES, setToolSettings, toolByKey } from "@/lib/tools";

/** Turns a tool on or off for everyone (super-admins keep it), or changes the daily AI limits. */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const key = typeof b.key === "string" ? b.key : "";
  if (key && !toolByKey(key) && !FEATURES.some((f) => f.key === key)) return err("Instrument necunoscut.");
  if (key && typeof b.on !== "boolean") return err("Alege dacă activezi sau dezactivezi instrumentul.");
  const limits = b.limits && typeof b.limits === "object" ? (b.limits as { ai_text?: number; ai_plan?: number }) : undefined;
  const v = await setToolSettings(a.db, a.c.user.id, { key: key || undefined, on: typeof b.on === "boolean" ? b.on : undefined, limits });
  await track(a.db, a.c, "admin", key ? (b.on ? "tool_on" : "tool_off") : "tool_limits", key || null, key ? undefined : v.limits);
  return NextResponse.json({ ok: true, ...v });
}
