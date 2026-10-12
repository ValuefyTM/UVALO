import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { setUserStatus } from "@/lib/orgs";
import { deleteUser } from "@/lib/merge";

/** `{ action: disable | enable | super_on | super_off | logout_all }` on any account (UVALO administration). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const e = await setUserStatus(a.db, a.c.user, (await params).id, str((await json(req)).action, 20));
  return e ? err(e) : NextResponse.json({ ok: true });
}

/** Deletes the account (e.g. a mistyped email), so the person can ask for an account again. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const r = await deleteUser(a.db, a.c.user, (await params).id);
  return "error" in r ? err(r.error!) : NextResponse.json(r);
}
