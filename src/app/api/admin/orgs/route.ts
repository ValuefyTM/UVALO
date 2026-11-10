import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { createOrg, inviteMember, validateOrg } from "@/lib/orgs";
import { validEmail } from "@/lib/crypto";
import { audit } from "@/lib/auth";
import { now } from "@/lib/db";
import { today } from "@/lib/access";

/**
 * New firm (UVALO administration): name, CUI, plan, seats, end date, and optionally its owner (`owner_email`, `owner_name`) invited right away.
 * `{action: "extend_expired"}`: every active firm whose "Acces până la" has passed gets no end date again (its people get their modules back at once).
 */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  if (b.action === "extend_expired") {
    const { results } = await a.db.prepare("SELECT id, name, valid_until FROM orgs WHERE status = 'active' AND valid_until IS NOT NULL AND valid_until < ?").bind(today())
      .all<{ id: string; name: string; valid_until: string }>();
    if (results.length) {
      await a.db.batch([
        a.db.prepare("UPDATE orgs SET valid_until = NULL, updated_at = ? WHERE status = 'active' AND valid_until IS NOT NULL AND valid_until < ?").bind(now(), today()),
        ...results.map((o) => a.db.prepare("INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (?, 'org.extend', 'org', ?, ?)").bind(a.c.user.id, o.id, `${o.name}: expirată ${o.valid_until} → fără termen`)),
      ]);
    }
    await audit(a.db, a.c.user.id, "org.extend_all", "orgs", undefined, `${results.length} firme`);
    return NextResponse.json({ ok: true, n: results.length });
  }
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
