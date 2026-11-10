import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { claimLegit } from "@/lib/office";

/** The office's administrator adds the ANEVAR card of a member without one (operațional → evaluator): `{ user, legit }`. */
export async function POST(req: Request) {
  const a = await api("orgAdmin");
  if ("res" in a) return a.res;
  const b = await json(req);
  const user = str(b.user, 64);
  const m = await a.db.prepare("SELECT 1 FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'").bind(a.c.org!.id, user).first();
  if (!m) return err("Persoana nu face parte din birou.");
  const r = await claimLegit(a.db, a.c.user, user, b.legit);
  return "error" in r ? err(r.error!) : NextResponse.json(r);
}
