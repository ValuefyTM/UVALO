import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { recommend } from "@/lib/referrals";
import { track } from "@/lib/track";

/** "Recomandă unui coleg": the colleague gets the link to request an account. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const r = await recommend(a.db, a.c.user, await json(req));
  if ("error" in r) return err(r.error!);
  await track(a.db, a.c, "app", "recommend");
  return NextResponse.json({ ok: true });
}
