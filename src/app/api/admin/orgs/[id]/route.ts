import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { getOrg, updateOrg, validateOrg } from "@/lib/orgs";

/** Edit a firm's details and subscription (plan, seats, end date, suspended). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const { id } = await params;
  if (!(await getOrg(a.db, id))) return err("Firma nu există.", 404);
  const v = await validateOrg(a.db, await json(req));
  if (!v.ok) return err(v.error);
  await updateOrg(a.db, a.c.user, id, v.v);
  return NextResponse.json({ ok: true });
}
