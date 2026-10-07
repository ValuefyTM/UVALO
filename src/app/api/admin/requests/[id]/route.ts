import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { approve, reject } from "@/lib/requests";

/** `{ action: "approve", plan_id, valid_until, org? }` or `{ action: "reject", note, notify }`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const { id } = await params;
  const e = b.action === "approve" ? await approve(a.db, a.c.user, id, b) : b.action === "reject" ? await reject(a.db, a.c.user, id, str(b.note, 500), b.notify === true) : "Acțiune necunoscută.";
  return e ? err(e) : NextResponse.json({ ok: true });
}
