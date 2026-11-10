import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { claimLegit } from "@/lib/office";

/** „Am devenit evaluator”: `{ legit }` → checked in the ANEVAR Tablou, the name / county / specializations are taken from there. */
export async function POST(req: Request) {
  const a = await api("user", { maint: true });
  if ("res" in a) return a.res;
  const r = await claimLegit(a.db, a.c.user, a.c.user.id, (await json(req)).legit);
  return "error" in r ? err(r.error!) : NextResponse.json(r);
}
