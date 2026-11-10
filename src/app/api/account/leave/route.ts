import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { cancelLeave, requestLeave } from "@/lib/office";

/** A member asks to leave the office for an individual account: `{ legit }` (checked against the ANEVAR Tablou). */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const r = await requestLeave(a.db, a.c, (await json(req)).legit);
  return "error" in r ? err(r.error!) : NextResponse.json(r);
}

/** Withdraws the request. */
export async function DELETE() {
  const a = await api();
  if ("res" in a) return a.res;
  const r = await cancelLeave(a.db, a.c);
  return "error" in r ? err(r.error!) : NextResponse.json(r);
}
