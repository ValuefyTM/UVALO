import { locatorAccess } from "@/lib/locator";
import { track } from "@/lib/track";
import { CHROME_VERSION } from "@/lib/chrome";

// GET /api/chrome/status — called by the UVALO pentru Chrome extension when its panel opens (with the UVALO session
// cookie): 200 when the person may use it, 401 signed out, 403 not in the plan / turned off, 503 maintenance.
export const dynamic = "force-dynamic";

const H = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const a = await locatorAccess("chrome");
  if ("status" in a) {
    const error = a.status === 401 ? "Conectează-te cu contul UVALO."
      : "maintenance" in a && a.maintenance ? "Platforma UVALO este în mentenanță. Revenim în curând."
      : a.c?.off.includes("chrome") ? "UVALO pentru Chrome este dezactivat temporar. Revine în curând."
      : a.c?.block ?? "Planul firmei tale nu include UVALO pentru Chrome.";
    return Response.json({ ok: false, error }, { status: a.status, headers: H });
  }
  const v = new URL(req.url).searchParams.get("v")?.slice(0, 20) ?? null;
  await track(a.db, a.c, "chrome", "open", null, v ? { v } : undefined);
  return Response.json({ ok: true, name: a.c.user.name || a.c.user.email, org: a.c.org?.name ?? null, latest: CHROME_VERSION }, { headers: H });
}
