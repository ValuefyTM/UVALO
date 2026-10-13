import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { decideLeave } from "@/lib/office";

/** The office's administrator decides on a request to leave: `{ approve: true | false }`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return a.res;
  const r = await decideLeave(a.db, a.c, (await params).id, (await json(req)).approve === true);
  return "error" in r ? err(r.error!) : NextResponse.json(r);
}
