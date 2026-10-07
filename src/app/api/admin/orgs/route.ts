import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { createOrg, inviteMember, validateOrg } from "@/lib/orgs";
import { validEmail } from "@/lib/crypto";

/** New firm (VALUEFY): name, CUI, plan, seats, end date, and optionally its owner (`owner_email`, `owner_name`) invited right away. */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const v = await validateOrg(a.db, b);
  if (!v.ok) return err(v.error);
  const ownerEmail = typeof b.owner_email === "string" ? b.owner_email.trim() : "";
  if (ownerEmail && !validEmail(ownerEmail)) return err("Emailul titularului nu pare valid.");
  const id = await createOrg(a.db, a.c.user, v.v);
  let invited = false;
  if (ownerEmail) {
    const r = await inviteMember(a.db, a.c.user, true, null, id, { email: ownerEmail, name: b.owner_name, role: "owner" });
    invited = r.ok;
  }
  return NextResponse.json({ ok: true, id, invited });
}
