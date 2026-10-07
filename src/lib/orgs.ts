// Server-only: firms, members, invitations and usage statistics.
import { now, uuid } from "./db";
import { audit, invite, revokeSessions, type User } from "./auth";
import { ORG_SQL, seatsUsed, type Org, type Role } from "./access";
import { validEmail } from "./crypto";

export type Member = {
  user_id: string; email: string; name: string; phone: string | null; status: string; role: Role; anevar_no: string | null;
  last_seen_at: string | null; last_login_at: string | null; activated_at: string | null; events_30: number; searches_30: number; exports_30: number;
};
export type Invite = { id: string; email: string; role: string; created_at: string; expires_at: string; invited_by_name: string | null };

const since = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

export async function members(db: D1Database, orgId: string) {
  const { results } = await db
    .prepare(`SELECT u.id AS user_id, u.email, u.name, u.phone, u.status, m.role, u.anevar_no, u.last_seen_at, u.last_login_at, u.activated_at,
        (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id AND e.org_id = m.org_id AND e.at > ?2) AS events_30,
        (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id AND e.org_id = m.org_id AND e.at > ?2 AND e.action IN ('search', 'search_multi', 'address', 'gps_start')) AS searches_30,
        (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id AND e.org_id = m.org_id AND e.at > ?2 AND e.action LIKE 'export%') AS exports_30
      FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ?1 AND m.status = 'active'
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name, u.email`)
    .bind(orgId, since(30))
    .all<Member>();
  return results;
}

export async function pendingInvites(db: D1Database, orgId: string) {
  const { results } = await db
    .prepare(`SELECT i.id, i.email, i.role, i.created_at, i.expires_at, COALESCE(NULLIF(u.name, ''), u.email) AS invited_by_name
      FROM invites i LEFT JOIN users u ON u.id = i.invited_by WHERE i.org_id = ? AND i.accepted_at IS NULL AND i.cancelled_at IS NULL ORDER BY i.created_at DESC`)
    .bind(orgId)
    .all<Invite>();
  return results;
}

export const getOrg = (db: D1Database, id: string) => db.prepare(`${ORG_SQL} WHERE o.id = ?`).bind(id).first<Org>();

const ROLES: Role[] = ["owner", "admin", "member"];

/** Invites a person into a firm, within its seats. Only owners (and VALUEFY) give the owner role. */
export async function inviteMember(db: D1Database, by: User, bySuper: boolean, byRole: Role | null, orgId: string, b: Record<string, unknown>) {
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!validEmail(email)) return { ok: false as const, error: "Adresa de email nu pare validă." };
  const role = ROLES.includes(b.role as Role) ? (b.role as Role) : "member";
  if (role === "owner" && !bySuper && byRole !== "owner") return { ok: false as const, error: "Doar titularul contului poate numi alt titular." };
  const org = await getOrg(db, orgId);
  if (!org) return { ok: false as const, error: "Firma nu există." };
  const already = await db.prepare("SELECT 1 AS x FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND u.email = ? AND m.status = 'active'")
    .bind(orgId, email.toLowerCase()).first();
  if (!already && (await seatsUsed(db, orgId)) >= org.seats) {
    return { ok: false as const, error: `Toate cele ${org.seats} locuri ale abonamentului sunt ocupate. ${bySuper ? "Mărește numărul de locuri." : "Scrie-ne pentru locuri în plus."}` };
  }
  const r = await invite(db, by, orgId, email, role, typeof b.name === "string" ? b.name : undefined);
  return { ok: true as const, ...r };
}

export async function setRole(db: D1Database, by: User, bySuper: boolean, byRole: Role | null, orgId: string, userId: string, role: Role) {
  if (!ROLES.includes(role)) return "Rol necunoscut.";
  const cur = await db.prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'").bind(orgId, userId).first<{ role: Role }>();
  if (!cur) return "Persoana nu face parte din firmă.";
  if ((role === "owner" || cur.role === "owner") && !bySuper && byRole !== "owner") return "Doar titularul contului poate schimba titularul.";
  if (cur.role === "owner" && role !== "owner") {
    const owners = await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE org_id = ? AND role = 'owner' AND status = 'active'").bind(orgId).first<{ n: number }>();
    if ((owners?.n ?? 0) <= 1) return "Firma trebuie să aibă cel puțin un titular de cont.";
  }
  await db.prepare("UPDATE memberships SET role = ? WHERE org_id = ? AND user_id = ?").bind(role, orgId, userId).run();
  await audit(db, by.id, "member.role", "org", orgId, `${userId} → ${role}`);
  return null;
}

export async function removeMember(db: D1Database, by: User, bySuper: boolean, byRole: Role | null, orgId: string, userId: string) {
  const cur = await db.prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'").bind(orgId, userId).first<{ role: Role }>();
  if (!cur) return "Persoana nu face parte din firmă.";
  if (userId === by.id) return "Nu te poți scoate singur din firmă.";
  if (cur.role === "owner" && !bySuper && byRole !== "owner") return "Doar titularul contului poate scoate un titular.";
  if (cur.role === "owner") {
    const owners = await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE org_id = ? AND role = 'owner' AND status = 'active'").bind(orgId).first<{ n: number }>();
    if ((owners?.n ?? 0) <= 1) return "Firma trebuie să aibă cel puțin un titular de cont.";
  }
  const t = now();
  await db.batch([
    db.prepare("UPDATE memberships SET status = 'removed', removed_at = ? WHERE org_id = ? AND user_id = ?").bind(t, orgId, userId),
    db.prepare("UPDATE invites SET cancelled_at = ? WHERE org_id = ? AND email = (SELECT email FROM users WHERE id = ?) AND accepted_at IS NULL AND cancelled_at IS NULL").bind(t, orgId, userId),
    db.prepare("UPDATE sessions SET org_id = NULL WHERE user_id = ? AND org_id = ?").bind(userId, orgId),
  ]);
  await audit(db, by.id, "member.remove", "org", orgId, userId);
  return null;
}

export async function cancelInvite(db: D1Database, by: User, orgId: string, inviteId: string) {
  const inv = await db.prepare("SELECT email FROM invites WHERE id = ? AND org_id = ? AND accepted_at IS NULL AND cancelled_at IS NULL").bind(inviteId, orgId).first<{ email: string }>();
  if (!inv) return "Invitația nu mai există.";
  const t = now();
  await db.batch([
    db.prepare("UPDATE invites SET cancelled_at = ? WHERE id = ?").bind(t, inviteId),
    // A person who never activated the account frees the seat.
    db.prepare("UPDATE memberships SET status = 'removed', removed_at = ? WHERE org_id = ? AND user_id = (SELECT id FROM users WHERE email = ? AND status = 'invited')").bind(t, orgId, inv.email),
  ]);
  await audit(db, by.id, "invite.cancel", "org", orgId, inv.email);
  return null;
}

// ---------- firms (VALUEFY administration) ----------

export type OrgInput = { name: string; cui: string | null; city: string | null; plan_id: string; seats: number; valid_until: string | null; status: string; billing_email: string | null; notes: string | null };

export async function validateOrg(db: D1Database, b: Record<string, unknown>): Promise<{ ok: true; v: OrgInput } | { ok: false; error: string }> {
  const s = (k: string, max = 160) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const name = s("name");
  if (name.length < 2) return { ok: false, error: "Completează numele firmei." };
  const plan = s("plan_id", 40) || "trial";
  if (!(await db.prepare("SELECT 1 AS x FROM plans WHERE id = ?").bind(plan).first())) return { ok: false, error: "Plan necunoscut." };
  const seats = Math.round(Number(b.seats) || 1);
  if (seats < 1 || seats > 500) return { ok: false, error: "Numărul de locuri trebuie să fie între 1 și 500." };
  const valid = s("valid_until", 10);
  if (valid && !/^\d{4}-\d{2}-\d{2}$/.test(valid)) return { ok: false, error: "Data de expirare nu este validă." };
  const status = s("status", 20) === "suspended" ? "suspended" : "active";
  return { ok: true, v: { name, cui: s("cui", 20) || null, city: s("city", 80) || null, plan_id: plan, seats, valid_until: valid || null, status, billing_email: s("billing_email") || null, notes: s("notes", 2000) || null } };
}

export async function createOrg(db: D1Database, by: User, v: OrgInput) {
  const id = uuid();
  await db.prepare("INSERT INTO orgs (id, name, cui, city, plan_id, seats, valid_until, status, billing_email, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, v.name, v.cui, v.city, v.plan_id, v.seats, v.valid_until, v.status, v.billing_email, v.notes, by.id).run();
  await audit(db, by.id, "org.create", "org", id, `${v.name} · ${v.plan_id} · ${v.seats} locuri`);
  return id;
}

export async function updateOrg(db: D1Database, by: User, id: string, v: OrgInput) {
  await db.prepare("UPDATE orgs SET name = ?, cui = ?, city = ?, plan_id = ?, seats = ?, valid_until = ?, status = ?, billing_email = ?, notes = ?, updated_at = ? WHERE id = ?")
    .bind(v.name, v.cui, v.city, v.plan_id, v.seats, v.valid_until, v.status, v.billing_email, v.notes, now(), id).run();
  await audit(db, by.id, "org.update", "org", id, `${v.plan_id} · ${v.seats} locuri · până la ${v.valid_until ?? "—"} · ${v.status}`);
}

export async function setUserStatus(db: D1Database, by: User, userId: string, action: string) {
  if (userId === by.id) return "Nu îți poți schimba singur accesul.";
  const u = await db.prepare("SELECT id, status, email FROM users WHERE id = ?").bind(userId).first<{ id: string; status: string; email: string }>();
  if (!u) return "Utilizatorul nu există.";
  if (action === "disable") {
    await db.prepare("UPDATE users SET status = 'disabled', disabled_at = ? WHERE id = ?").bind(now(), userId).run();
    await revokeSessions(db, userId);
  } else if (action === "enable") {
    await db.prepare("UPDATE users SET status = CASE WHEN activated_at IS NULL THEN 'invited' ELSE 'active' END, disabled_at = NULL WHERE id = ?").bind(userId).run();
  } else if (action === "super_on" || action === "super_off") {
    await db.prepare("UPDATE users SET is_superadmin = ? WHERE id = ?").bind(action === "super_on" ? 1 : 0, userId).run();
  } else if (action === "logout_all") {
    await revokeSessions(db, userId);
  } else return "Acțiune necunoscută.";
  await audit(db, by.id, `user.${action}`, "user", userId, u.email);
  return null;
}

// ---------- statistics ----------

export async function activityByDay(db: D1Database, days: number, orgId?: string, userId?: string) {
  const w = ["at > ?"], p: unknown[] = [since(days)];
  if (orgId) { w.push("org_id = ?"); p.push(orgId); }
  if (userId) { w.push("user_id = ?"); p.push(userId); }
  const { results } = await db.prepare(`SELECT substr(at, 1, 10) AS d, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM events WHERE ${w.join(" AND ")} GROUP BY d ORDER BY d`)
    .bind(...p).all<{ d: string; n: number; u: number }>();
  const map = new Map(results.map((r) => [r.d, r]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10);
    return map.get(d) ?? { d, n: 0, u: 0 };
  });
}

export async function topActions(db: D1Database, days: number, orgId?: string) {
  const { results } = await db.prepare(`SELECT module, action, COUNT(*) AS n FROM events WHERE at > ? ${orgId ? "AND org_id = ?" : ""} GROUP BY module, action ORDER BY n DESC LIMIT 20`)
    .bind(...(orgId ? [since(days), orgId] : [since(days)])).all<{ module: string; action: string; n: number }>();
  return results;
}

export async function topTargets(db: D1Database, days: number, action: string, orgId?: string) {
  const { results } = await db.prepare(`SELECT target, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM events WHERE at > ? AND action = ? AND target IS NOT NULL ${orgId ? "AND org_id = ?" : ""} GROUP BY target ORDER BY n DESC LIMIT 15`)
    .bind(...(orgId ? [since(days), action, orgId] : [since(days), action])).all<{ target: string; n: number; u: number }>();
  return results;
}

export type EventRow = { id: number; at: string; module: string; action: string; target: string | null; meta: string | null; user_name: string | null; email: string | null; org_name: string | null };

export async function recentEvents(db: D1Database, f: { orgId?: string; userId?: string; action?: string; limit?: number }) {
  const w: string[] = [], p: unknown[] = [];
  if (f.orgId) { w.push("e.org_id = ?"); p.push(f.orgId); }
  if (f.userId) { w.push("e.user_id = ?"); p.push(f.userId); }
  if (f.action) { w.push("e.action = ?"); p.push(f.action); }
  const { results } = await db.prepare(`SELECT e.id, e.at, e.module, e.action, e.target, e.meta, NULLIF(u.name, '') AS user_name, u.email, o.name AS org_name
      FROM events e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN orgs o ON o.id = e.org_id ${w.length ? `WHERE ${w.join(" AND ")}` : ""} ORDER BY e.id DESC LIMIT ?`)
    .bind(...p, f.limit ?? 200).all<EventRow>();
  return results;
}

export const ACTION_LABEL: Record<string, string> = {
  login: "Autentificare", page: "Pagină deschisă", uat_open: "Plan UAT încărcat", search: "Căutare nr. cadastral / topo", search_multi: "Căutare multiplă",
  parcel: "Parcelă deschisă", building: "Construcție deschisă", address: "Căutare adresă / coordonate", gps_start: "Locația mea (GPS)", compass: "Busolă",
  export_pdf: "Export PDF", export_word: "Export Word", export_png: "Export PNG", export_kml: "Export KML", export: "Export", link: "Link copiat",
};
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;
