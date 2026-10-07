import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";

/** Switches the firm of the current session. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const org = str((await json(req)).org, 60);
  if (!a.c.orgs.some((o) => o.org_id === org)) return err("Nu faci parte din această firmă.", 403);
  await a.db.prepare("UPDATE sessions SET org_id = ? WHERE id = ?").bind(org, a.c.session.id).run();
  return NextResponse.json({ ok: true });
}
