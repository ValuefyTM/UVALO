import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { mergeUsers } from "@/lib/merge";

/** Two accounts of the same person → one (`{ keep, from }`: `from` is moved into `keep`, then deleted). */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const r = await mergeUsers(a.db, a.c.user, str(b.keep, 60), str(b.from, 60));
  return "error" in r ? err(r.error!) : NextResponse.json(r);
}
