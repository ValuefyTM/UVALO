import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { discard, PlanError, publish } from "@/lib/plans";

/** Publishes a converted plan (into the locator, with a deploy) or discards it; /api/admin/plans/toate publishes several ({ ids }). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const { id } = await params;
  const b = await json(req);
  try {
    if (b.action === "publish") await publish(a.db, a.c, id === "toate" ? (Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string") : []) : [id]);
    else if (b.action === "discard") await discard(a.db, a.c, id);
    else return err("Acțiune necunoscută.");
  } catch (e) {
    if (e instanceof PlanError) return err(e.message, 409);
    throw e;
  }
  return NextResponse.json({ ok: true });
}
