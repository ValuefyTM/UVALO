// Server-only: two accounts of the same person become one (e.g. an administrator account made with the work email and the
// account from the ANEVAR list). The kept account keeps its email; it takes the profile of the other (name, card number,
// county, specializations, phone, picture) where the other has one, plus its firms, sessions, activity and data. The other
// account is then deleted; a copy of its profile stays in the audit log.
import { now } from "./db";
import { audit, type User } from "./auth";

type Row = {
  id: string; email: string; name: string; phone: string | null; status: string; is_superadmin: number; anevar_no: string | null; county: string | null; specs: string | null;
  avatar: string | null; is_office: number; terms_at: string | null; loc_ack_at: string | null; created_at: string; activated_at: string | null; last_login_at: string | null;
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
    is_superadmin: Math.max(keep.is_superadmin, from.is_superadmin), is_office: Math.max(keep.is_office, from.is_office),
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
    db.prepare(`UPDATE users SET name = ?, phone = ?, anevar_no = ?, county = ?, specs = ?, avatar = ?, is_superadmin = ?, is_office = ?, status = ?, terms_at = ?,
      loc_ack_at = ?, created_at = ?, activated_at = ?, last_login_at = ?, last_seen_at = ?, notes = ?, disabled_at = CASE WHEN ? = 'active' THEN NULL ELSE disabled_at END WHERE id = ?`)
      .bind(v.name, v.phone, v.anevar_no, v.county, v.specs, v.avatar, v.is_superadmin, v.is_office, v.status, v.terms_at, v.loc_ack_at, v.created_at, v.activated_at,
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
