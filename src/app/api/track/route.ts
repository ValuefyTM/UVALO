import { api, json } from "@/lib/api";
import { track } from "@/lib/track";

const MODULES = new Set(["localizare", "comparabile"]);

/** Usage events from the module pages (batches of up to 50). */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  const module = typeof b.module === "string" && MODULES.has(b.module) ? b.module : null;
  if (!module || !Array.isArray(b.events)) return Response.json({ ok: false }, { status: 400 });
  for (const e of b.events.slice(0, 50)) {
    if (!e || typeof e !== "object") continue;
    const ev = e as Record<string, unknown>;
    const action = typeof ev.action === "string" && /^[a-z_]{2,30}$/.test(ev.action) ? ev.action : null;
    if (!action) continue;
    await track(a.db, a.c, module, action, typeof ev.target === "string" ? ev.target : null, ev.meta && typeof ev.meta === "object" ? ev.meta : undefined);
  }
  return Response.json({ ok: true });
}
