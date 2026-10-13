// Server-only: two accounts of the same person become one (e.g. an administrator account made with the work email and the
// account from the ANEVAR list). The kept account keeps its email; it takes the profile of the other (name, card number,
// county, specializations, phone, picture) where the other has one, plus its firms, sessions, activity and data. The other
// account is then deleted; a copy of its profile stays in the audit log.
import { now } from "./db";
import { audit, type User } from "./auth";

type Row = {
  id: string; email: string; name: string; phone: string | null; status: string; is_superadmin: number; anevar_no: string | null; county: string | null; specs: string | null;
  avatar: string | null; is_office: number; office_allowed: number; terms_at: string | null; loc_ack_at: string | null; created_at: string; activated_at: string | null; last_login_at: string | null;
  last_seen_at: string | null; notes: string | null;
};
const RANK: Record<string, number> = { owner: 3, admin: 2, member: 1 };
const filled = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v : null);
const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export async function mergeUsers(db: D1Database, by: User, keepId: string, fromId: string) {
  if (!keepId || !fromId || keepId === fromId) return { error: "Alege două conturi diferite." };
  if (fromId === by.id) return { error: "Nu poți șterge contul cu care ești conectat: alege-l drept contul care rămâne." };
  const [keep, from] = await Promise.all([keepId, fromId].map((id) => db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<Row>()));
  if (!keep || !from) return { error: "Unul dintre conturi nu mai există." };

  // the profile: the other account's values where it has them
  const v = {
    name: filled(from.name) ?? keep.name, phone: filled(from.phone) ?? keep.phone, anevar_no: filled(from.anevar_no) ?? keep.anevar_no,
    county: filled(from.county) ?? keep.county, specs: filled(from.specs) ?? keep.specs, avatar: filled(from.avatar) ?? keep.avatar,
    is_superadmin: Math.max(keep.is_superadmin, from.is_superadmin), is_office: Math.max(keep.is_office, from.is_office), office_allowed: Math.max(keep.office_allowed ?? 0, from.office_allowed ?? 0),
    status: keep.status === "active" || from.status === "active" ? "active" : keep.status,
    terms_at: minIso(keep.terms_at, from.terms_at), loc_ack_at: maxIso(keep.loc_ack_at, from.loc_ack_at), created_at: minIso(keep.created_at, from.created_at)!,
    activated_at: minIso(keep.activated_at, from.activated_at), last_login_at: maxIso(keep.last_login_at, from.last_login_at), last_seen_at: maxIso(keep.last_seen_at, from.last_seen_at),
    notes: [filled(keep.notes), filled(from.notes), `Unit cu contul ${from.email} pe ${now().slice(0, 10)}.`].filter(Boolean).join("\n"),
  };

  // firms: one membership per firm, with the higher role
  const { results: ms } = await db.prepare("SELECT org_id, user_id, role, status FROM memberships WHERE user_id IN (?, ?)").bind(keepId, fromId)
    .all<{ org_id: string; user_id: string; role: string; status: string }>();
  const st: D1PreparedStatement[] = [];
  for (const m of ms.filter((x) => x.user_id === fromId)) {
    const k = ms.find((x) => x.user_id === keepId && x.org_id === m.org_id);
    if (!k) { st.push(db.prepare("UPDATE memberships SET user_id = ? WHERE org_id = ? AND user_id = ?").bind(keepId, m.org_id, fromId)); continue; }
    const role = (RANK[m.role] ?? 0) > (RANK[k.role] ?? 0) ? m.role : k.role, active = k.status === "active" || m.status === "active";
    st.push(db.prepare("UPDATE memberships SET role = ?, status = ?, removed_at = CASE WHEN ? THEN NULL ELSE removed_at END WHERE org_id = ? AND user_id = ?")
      .bind(role, active ? "active" : k.status, active ? 1 : 0, m.org_id, keepId));
    st.push(db.prepare("DELETE FROM memberships WHERE org_id = ? AND user_id = ?").bind(m.org_id, fromId));
  }

  const move = (sql: string) => db.prepare(sql).bind(keepId, fromId);
  st.push(
    move("UPDATE sessions SET user_id = ? WHERE user_id = ?"),
    move("UPDATE events SET user_id = ? WHERE user_id = ?"),
    move("UPDATE audit_log SET actor_id = ? WHERE actor_id = ?"),
    move("UPDATE orgs SET created_by = ? WHERE created_by = ?"),
    move("UPDATE invites SET invited_by = ? WHERE invited_by = ?"),
    move("UPDATE account_requests SET decided_by = ? WHERE decided_by = ?"),
    move("UPDATE account_requests SET user_id = ? WHERE user_id = ?"),
    move("UPDATE referrals SET by_user = ? WHERE by_user = ?"),
    move("UPDATE plan_uploads SET created_by = ? WHERE created_by = ?"),
    move("UPDATE users SET created_by = ? WHERE created_by = ?"),
    move("UPDATE chrome_batches SET user_id = ? WHERE user_id = ?"),
    move("UPDATE feedback SET user_id = ? WHERE user_id = ?"),
    move("UPDATE office_leaves SET user_id = ? WHERE user_id = ?"),
    move("UPDATE office_leaves SET decided_by = ? WHERE decided_by = ?"),
    db.prepare("DELETE FROM email_changes WHERE user_id = ?").bind(fromId),
    // Colaborări: one profile (the kept one, if it has one); a request twice on the same post keeps the kept account's
    move("UPDATE OR IGNORE collab_profiles SET user_id = ? WHERE user_id = ?"),
    db.prepare("DELETE FROM collab_profiles WHERE user_id = ?").bind(fromId),
    move("UPDATE collab_posts SET user_id = ? WHERE user_id = ?"),
    move("UPDATE collab_posts SET chosen_id = ? WHERE chosen_id = ?"),
    move("UPDATE OR IGNORE collab_requests SET user_id = ? WHERE user_id = ?"),
    db.prepare("DELETE FROM collab_messages WHERE conv_id IN (SELECT c.id FROM collab_convs c JOIN collab_requests r ON r.id = c.request_id WHERE r.user_id = ?)").bind(fromId),
    db.prepare("DELETE FROM collab_convs WHERE request_id IN (SELECT id FROM collab_requests WHERE user_id = ?)").bind(fromId),
    db.prepare("DELETE FROM collab_requests WHERE user_id = ?").bind(fromId),
    move("UPDATE collab_convs SET author_id = ? WHERE author_id = ?"),
    move("UPDATE collab_convs SET peer_id = ? WHERE peer_id = ?"),
    move("UPDATE collab_messages SET user_id = ? WHERE user_id = ?"),
    move("UPDATE collab_notifs SET user_id = ? WHERE user_id = ?"),
    db.prepare("DELETE FROM users WHERE id = ?").bind(fromId),
    db.prepare(`UPDATE users SET name = ?, phone = ?, anevar_no = ?, county = ?, specs = ?, avatar = ?, is_superadmin = ?, is_office = ?, office_allowed = ?, status = ?, terms_at = ?,
      loc_ack_at = ?, created_at = ?, activated_at = ?, last_login_at = ?, last_seen_at = ?, notes = ?, disabled_at = CASE WHEN ? = 'active' THEN NULL ELSE disabled_at END WHERE id = ?`)
      .bind(v.name, v.phone, v.anevar_no, v.county, v.specs, v.avatar, v.is_superadmin, v.is_office, v.office_allowed, v.status, v.terms_at, v.loc_ack_at, v.created_at, v.activated_at,
        v.last_login_at, v.last_seen_at, v.notes, v.status, keepId),
  );
  await db.batch(st); // one transaction: all or nothing

  // settings that name people: Colaborări test group, AI limit exceptions
  for (const key of ["collab", "limits:users"]) {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{ value: string }>().catch(() => null);
    if (!row || !row.value.includes(fromId)) continue;
    const d = JSON.parse(row.value) as Record<string, unknown>;
    if (key === "collab" && Array.isArray(d.users)) d.users = [...new Set((d.users as string[]).map((x) => (x === fromId ? keepId : x)))];
    if (key === "limits:users" && d[fromId]) { if (!d[keepId]) d[keepId] = d[fromId]; delete d[fromId]; }
    await db.prepare("UPDATE app_settings SET value = ?, updated_at = ?, updated_by = ? WHERE key = ?").bind(JSON.stringify(d), now(), by.id, key).run();
  }

  const { avatar: _a, ...snapshot } = from;
  await audit(db, by.id, "user.merge", "user", keepId, JSON.stringify({ kept: keep.email, removed: snapshot }).slice(0, 4000));
  return { ok: true, name: v.name, email: keep.email };
}

/**
 * Deletes an account (e.g. made with a mistyped email), so the person can ask for an account again with the right address.
 * Removes its sessions, sign-in codes, firm memberships, open invitations, Chrome captures and Colaborări data; a firm made
 * only for this person (no other members or invitations) goes too. Activity stays in `events`; a copy stays in the audit log.
 */
export async function deleteUser(db: D1Database, by: User, id: string) {
  if (id === by.id) return { error: "Nu îți poți șterge propriul cont." };
  const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<Row>();
  if (!u) return { error: "Contul nu mai există." };
  if (u.is_superadmin) return { error: "Scoate întâi drepturile de administrator UVALO." };
  const email = u.email.toLowerCase();

  // firms where this person is the only one (an individual account): deleted with it
  const { results: lone } = await db.prepare(`SELECT m.org_id AS id FROM memberships m WHERE m.user_id = ?
      AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.org_id = m.org_id AND o.user_id <> ?)
      AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.org_id = m.org_id AND lower(i.email) <> ?)
      AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.org_id = m.org_id AND s.user_id <> ?)`)
    .bind(id, id, email, id).all<{ id: string }>();

  const one = (sql: string) => db.prepare(sql).bind(id);
  const st: D1PreparedStatement[] = [
    one("DELETE FROM sessions WHERE user_id = ?"),
    one("DELETE FROM email_changes WHERE user_id = ?"),
    db.prepare("DELETE FROM auth_codes WHERE lower(email) = ?").bind(email),
    db.prepare("UPDATE invites SET cancelled_at = ? WHERE lower(email) = ? AND accepted_at IS NULL AND cancelled_at IS NULL").bind(now(), email),
    one("DELETE FROM memberships WHERE user_id = ?"),
    one("DELETE FROM chrome_slices WHERE batch_id IN (SELECT id FROM chrome_batches WHERE user_id = ?)"),
    one("DELETE FROM chrome_batches WHERE user_id = ?"),
    one("UPDATE feedback SET user_id = NULL WHERE user_id = ?"),
    one("DELETE FROM office_leaves WHERE user_id = ?"),
    one("UPDATE office_leaves SET decided_by = NULL WHERE decided_by = ?"),
    one("DELETE FROM referrals WHERE by_user = ?"),
    one("UPDATE account_requests SET user_id = NULL WHERE user_id = ?"),
    one("UPDATE account_requests SET decided_by = NULL WHERE decided_by = ?"),
    one("UPDATE orgs SET created_by = NULL WHERE created_by = ?"),
    one("UPDATE invites SET invited_by = NULL WHERE invited_by = ?"),
    one("UPDATE users SET created_by = NULL WHERE created_by = ?"),
    // Colaborări: the person's posts (with everything on them), requests, conversations, messages, notifications, profile
    db.prepare(`DELETE FROM collab_messages WHERE user_id = ?1 OR conv_id IN (SELECT id FROM collab_convs WHERE author_id = ?1 OR peer_id = ?1
      OR post_id IN (SELECT id FROM collab_posts WHERE user_id = ?1))`).bind(id),
    db.prepare("DELETE FROM collab_convs WHERE author_id = ?1 OR peer_id = ?1 OR post_id IN (SELECT id FROM collab_posts WHERE user_id = ?1)").bind(id),
    db.prepare("DELETE FROM collab_requests WHERE user_id = ?1 OR post_id IN (SELECT id FROM collab_posts WHERE user_id = ?1)").bind(id),
    one("UPDATE collab_posts SET chosen_id = NULL WHERE chosen_id = ?"),
    one("DELETE FROM collab_notifs WHERE user_id = ?"),
    one("DELETE FROM collab_posts WHERE user_id = ?"),
    one("DELETE FROM collab_profiles WHERE user_id = ?"),
  ];
  for (const o of lone) {
    st.push(db.prepare("DELETE FROM invites WHERE org_id = ?").bind(o.id), db.prepare("UPDATE sessions SET org_id = NULL WHERE org_id = ?").bind(o.id),
      db.prepare("DELETE FROM orgs WHERE id = ?").bind(o.id));
  }
  st.push(one("DELETE FROM users WHERE id = ?"));
  await db.batch(st); // one transaction: all or nothing

  const row = await db.prepare("SELECT value FROM app_settings WHERE key = 'collab'").first<{ value: string }>().catch(() => null);
  if (row?.value.includes(id)) {
    const d = JSON.parse(row.value) as { users?: string[] };
    d.users = (d.users ?? []).filter((x) => x !== id);
    await db.prepare("UPDATE app_settings SET value = ?, updated_at = ?, updated_by = ? WHERE key = 'collab'").bind(JSON.stringify(d), now(), by.id).run();
  }
  const { avatar: _a, ...snapshot } = u;
  await audit(db, by.id, "user.delete", "user", id, JSON.stringify({ removed: snapshot, orgs: lone.map((o) => o.id) }).slice(0, 4000));
  return { ok: true, email: u.email, orgs: lone.length };
}

export const CLOSE_REASONS: [string, string][] = [
  ["nu_folosesc", "Nu folosesc platforma"], ["lipsa_functii", "Lipsesc funcții de care am nevoie"], ["alt_instrument", "Folosesc alt instrument"],
  ["nu_mai_evaluez", "Nu mai lucrez ca evaluator"], ["alt_cont", "Am alt cont"], ["altceva", "Alt motiv"],
];

/**
 * The person closes their own account ("Contul meu" → "Închide contul"): nothing is deleted. The account gets status
 * 'closed' (Admin → Utilizatori → "Au renunțat"), its sessions are signed out but kept, history stays, the seat in a firm
 * is freed; in Colaborări the profile stops receiving notifications and the active posts are archived. Asking for an
 * account again (same email) makes it active again.
 */
export async function closeAccount(db: D1Database, u: User, reason: string, note: string) {
  if (u.is_superadmin) return { error: "Contul de administrator UVALO nu se poate închide singur. Cere altui administrator să-ți scoată drepturile." };
  // the person runs a firm that has colleagues: the firm must not be left without someone to run it
  const firm = await db.prepare(`SELECT o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ?1 AND m.status = 'active' AND m.role IN ('owner', 'admin')
      AND NOT EXISTS (SELECT 1 FROM memberships x JOIN users xu ON xu.id = x.user_id WHERE x.org_id = m.org_id AND x.user_id <> ?1 AND x.status = 'active' AND x.role IN ('owner', 'admin') AND xu.status = 'active')
      AND EXISTS (SELECT 1 FROM memberships y JOIN users yu ON yu.id = y.user_id WHERE y.org_id = m.org_id AND y.user_id <> ?1 AND y.status = 'active' AND yu.status IN ('active', 'invited')) LIMIT 1`)
    .bind(u.id).first<{ name: string }>();
  if (firm) return { error: `Administrezi firma ${firm.name}, care mai are colegi. Fă întâi pe altcineva administrator din „Firma mea” sau scrie-ne la office@uvalo.ro.` };
  const why = CLOSE_REASONS.find(([k]) => k === reason)?.[1] ?? null;
  const text = [why, note.trim().slice(0, 500) || null].filter(Boolean).join(" — ") || null;
  const t = now();
  await db.batch([
    db.prepare("UPDATE users SET status = 'closed', closed_at = ?, close_reason = ? WHERE id = ?").bind(t, text, u.id),
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(t, u.id),
    db.prepare("UPDATE collab_profiles SET available = 0 WHERE user_id = ?").bind(u.id),
    db.prepare("UPDATE collab_posts SET status = 'archived' WHERE user_id = ? AND status = 'active'").bind(u.id),
  ]);
  await audit(db, u.id, "user.close", "user", u.id, text ?? undefined);
  return { ok: true };
}
