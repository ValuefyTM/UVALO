import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { resendInvite } from "@/lib/auth";
import { canManageOrg, type Role } from "@/lib/access";
import { cancelInvite, inviteMember, removeMember, setRole } from "@/lib/orgs";

/** The firm being managed: the current one, or any firm for a VALUEFY super-admin (`org` in the body / query). */
async function target(req: Request, body?: Record<string, unknown>) {
  const a = await api();
  if ("res" in a) return a;
  const asked = str(body?.org ?? new URL(req.url).searchParams.get("org"), 60);
  const orgId = asked && a.c.super ? asked : a.c.org?.id;
  if (!orgId || (!a.c.super && !canManageOrg(a.c))) return { res: err("Doar administratorii firmei pot face asta.", 403) };
  return { ...a, orgId, role: (asked && a.c.super ? null : a.c.role) as Role | null };
}

/** Invite (`email`, `name`, `role`), resend (`resend`: invite id) or cancel (`cancel`: invite id). */
export async function POST(req: Request) {
  const b = await json(req);
  const t = await target(req, b);
  if ("res" in t) return t.res;
  if (typeof b.resend === "string") return (await resendInvite(t.db, b.resend, t.c.user)) ? NextResponse.json({ ok: true }) : err("Invitația nu a putut fi retrimisă.");
  if (typeof b.cancel === "string") { const e = await cancelInvite(t.db, t.c.user, t.orgId, b.cancel); return e ? err(e) : NextResponse.json({ ok: true }); }
  const r = await inviteMember(t.db, t.c.user, t.c.super, t.role, t.orgId, b);
  if (!r.ok) return err(r.error);
  return NextResponse.json({ ok: true, sent: r.sent, active: r.active });
}

/** Changes a member's role: `{ user, role }`. */
export async function PATCH(req: Request) {
  const b = await json(req);
  const t = await target(req, b);
  if ("res" in t) return t.res;
  const e = await setRole(t.db, t.c.user, t.c.super, t.role, t.orgId, str(b.user, 60), str(b.role, 20) as Role);
  return e ? err(e) : NextResponse.json({ ok: true });
}

/** Removes a member: `?user=`. */
export async function DELETE(req: Request) {
  const t = await target(req);
  if ("res" in t) return t.res;
  const e = await removeMember(t.db, t.c.user, t.c.super, t.role, t.orgId, new URL(req.url).searchParams.get("user") ?? "");
  return e ? err(e) : NextResponse.json({ ok: true });
}
