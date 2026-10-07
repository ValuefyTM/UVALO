import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { setUserStatus } from "@/lib/orgs";

/** `{ action: disable | enable | super_on | super_off | logout_all }` on any account (VALUEFY). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const e = await setUserStatus(a.db, a.c.user, (await params).id, str((await json(req)).action, 20));
  return e ? err(e) : NextResponse.json({ ok: true });
}
