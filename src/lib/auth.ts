// Server-only: invite-only sign-in by email (6-digit code or one-time link), sessions per device, invitations.
import { cookies, headers } from "next/headers";
import { now, uuid } from "./db";
import { normEmail, randomCode, randomToken, safeEqual, sha256 } from "./crypto";
import { esc, greetName, layout, sendEmail } from "./email";
import { origin } from "./site";

export const COOKIE = "vf_tools";
const SESSION_DAYS = 60;
const CODE_MINUTES = 15;
const INVITE_DAYS = 14;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

export type User = {
  id: string; email: string; name: string; phone: string | null; status: "invited" | "active" | "disabled" | "closed"; is_superadmin: number;
  anevar_no: string | null; county: string | null; specs: string | null; has_avatar: number; is_office: number; office_allowed: number; terms_at: string | null; created_at: string; activated_at: string | null; last_login_at: string | null; last_seen_at: string | null;
  notes: string | null;
};

export async function audit(db: D1Database, actor: string | null, action: string, entity?: string, entityId?: string, details?: string) {
  await db.prepare("INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)")
    .bind(actor, action, entity ?? null, entityId ?? null, details ?? null).run();
}

// The picture is not loaded with the account (it is served by /api/avatar/<id>).
const USER_COLS = `id, email, name, phone, status, is_superadmin, anevar_no, county, specs, avatar IS NOT NULL AS has_avatar, is_office, office_allowed, terms_at, created_at, activated_at,
  last_login_at, last_seen_at, notes`;
export const getUser = (db: D1Database, id: string) => db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).bind(id).first<User>();
export const findUser = (db: D1Database, email: string) => db.prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`).bind(normEmail(email)).first<User>();

/** Emails in TOOLS_SUPERADMINS get a super-admin account on their first sign-in (bootstraps the platform). */
const superEmails = () => (process.env.TOOLS_SUPERADMINS || "").split(",").map(normEmail).filter(Boolean);

async function accountFor(db: D1Database, email: string) {
  const e = normEmail(email);
  const u = await findUser(db, e);
  if (u) {
    if (!u.is_superadmin && superEmails().includes(e)) await db.prepare("UPDATE users SET is_superadmin = 1 WHERE id = ?").bind(u.id).run();
    return u.is_superadmin || !superEmails().includes(e) ? u : getUser(db, u.id);
  }
  if (!superEmails().includes(e)) return null;
  const id = uuid();
  await db.prepare("INSERT INTO users (id, email, status, is_superadmin, activated_at, terms_at) VALUES (?, ?, 'active', 1, ?, ?)").bind(id, e, now(), now()).run();
  await audit(db, null, "user.bootstrap", "user", id, e);
  return getUser(db, id);
}

/** Active accounts sign in; invited ones first accept the invitation (link in their email). */
const canSignIn = (u: User) => u.status === "active";

/* ---------- failed attempts (migration 0042): a limit across codes, accounts and addresses ---------- */
/** Failed attempts for a key in the last `minutes`. */
export async function failCount(db: D1Database, key: string, minutes: number) {
  return (await db.prepare("SELECT COUNT(*) AS n FROM auth_fails WHERE key = ? AND at > ?").bind(key, inMinutes(-minutes)).first<{ n: number }>())?.n ?? 0;
}
/** Records a failed attempt under each key; now and then drops the ones older than two days. */
export async function addFail(db: D1Database, ...keys: string[]) {
  const t = now();
  await db.batch([
    ...keys.map((k) => db.prepare("INSERT INTO auth_fails (key, at) VALUES (?, ?)").bind(k, t)),
    ...(Math.random() < 0.05 ? [db.prepare("DELETE FROM auth_fails WHERE at < ?").bind(inMinutes(-2 * 24 * 60))] : []),
  ]);
}

export async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

// ---------- sign-in ----------

/** Sends a code + link when the email has an active account. Same answer either way (no account enumeration). */
export async function requestSignIn(db: D1Database, rawEmail: string) {
  const email = normEmail(rawEmail);
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM auth_codes WHERE email = ? AND created_at > ? AND COALESCE(ip, '') <> 'notify'").bind(email, inMinutes(-60)).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_CODES_PER_HOUR) return;
  const u = await accountFor(db, email);
  if (!u) return;
  if (u.status === "invited") {
    // Resend the pending invitation instead.
    const inv = await db.prepare("SELECT id FROM invites WHERE email = ? AND accepted_at IS NULL AND cancelled_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1").bind(email, now()).first<{ id: string }>();
    if (inv) await resendInvite(db, inv.id, null);
    return;
  }
  if (!canSignIn(u)) return;
  const code = randomCode();
  const token = randomToken();
  await db.prepare("INSERT INTO auth_codes (id, email, code_hash, token_hash, expires_at, ip) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(uuid(), email, await sha256(`${email}:${code}`), await sha256(token), inMinutes(CODE_MINUTES), await clientIp()).run();
  const link = `${await origin()}/login/link?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: `Codul tău UVALO: ${code}`,
    text: `Codul tău de autentificare în UVALO este ${code}.\nSau deschide linkul: ${link}\nCodul și linkul sunt valabile ${CODE_MINUTES} minute.`,
    html: layout({
      eyebrow: "UVALO",
      title: "Codul tău de autentificare",
      body: `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#4A4A4A">Introdu codul de mai jos în pagina de autentificare:</p>
<p style="margin:16px 0;font-size:34px;font-weight:bold;letter-spacing:8px;font-family:ui-monospace,Menlo,monospace">${code}</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#4A4A4A">Sau intră direct apăsând butonul.</p>`,
      button: { label: "Intră în cont →", url: link },
      foot: `Codul și linkul sunt valabile ${CODE_MINUTES} minute și pot fi folosite o singură dată. Dacă nu ai cerut tu autentificarea, ignoră acest email.`,
    }),
  });
}

/** Wrong email codes: at most 10 a day for an account (across all the codes asked for) and 30 an hour from one address. */
const CODE_FAILS_DAY = 10, CODE_FAILS_IP_HOUR = 30;
// the button „Intră în cont” of the email still works (a 256-bit link cannot be guessed): someone who types wrong codes on purpose cannot lock the owner out
export const TOO_MANY = "Prea multe coduri greșite pentru acest cont: codul nu mai e acceptat până mâine. Intră cu butonul „Intră în cont” din emailul primit (merge în continuare) sau scrie-ne la office@uvalo.ro.";

export async function verifyCode(db: D1Database, rawEmail: string, code: string): Promise<User | { error: string } | null> {
  const email = normEmail(rawEmail), ip = (await clientIp()) ?? "-";
  if ((await failCount(db, `code:${email}`, 24 * 60)) >= CODE_FAILS_DAY) return { error: TOO_MANY };
  if ((await failCount(db, `codeip:${ip}`, 60)) >= CODE_FAILS_IP_HOUR) return { error: "Prea multe coduri greșite de la această conexiune. Încearcă din nou peste o oră." };
  const row = await db
    .prepare("SELECT id, code_hash, attempts FROM auth_codes WHERE email = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1")
    .bind(email, now())
    .first<{ id: string; code_hash: string; attempts: number }>();
  if (!row || row.attempts >= MAX_ATTEMPTS) return null; // nothing to guess: not counted
  if (!safeEqual(row.code_hash, await sha256(`${email}:${code.replace(/\D/g, "")}`))) {
    await db.prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
    await addFail(db, `code:${email}`, `codeip:${ip}`);
    return null;
  }
  await db.prepare("UPDATE auth_codes SET used_at = ? WHERE id = ?").bind(now(), row.id).run();
  const u = await findUser(db, email);
  return u && canSignIn(u) ? u : null;
}

/**
 * After a correct code: a sign-in link valid 2 minutes, which the page opens right away. The session cookie is set again by that page load,
 * like the button from the email: some phones (installed apps, strict browsers) do not keep a cookie set by a background request.
 */
export async function handoffLink(db: D1Database, email: string, next: string) {
  const token = randomToken();
  await db.prepare("INSERT INTO auth_codes (id, email, code_hash, token_hash, expires_at, ip) VALUES (?, ?, ?, ?, ?, 'notify')")
    .bind(uuid(), normEmail(email), await sha256(randomToken()), await sha256(token), inMinutes(2)).run();
  return `/login/link?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
}

export async function consumeLink(db: D1Database, token: string) {
  const row = await db.prepare("SELECT id, email FROM auth_codes WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?").bind(await sha256(token), now()).first<{ id: string; email: string }>();
  if (!row) return null;
  await db.prepare("UPDATE auth_codes SET used_at = ? WHERE id = ?").bind(now(), row.id).run();
  const u = await findUser(db, row.email);
  return u && canSignIn(u) ? u : null;
}

/**
 * A one-time sign-in link for a notification email (e.g. a new post in Colaborări), valid a few days, that opens `next`.
 * Already signed in → it just opens `next`. Stored like a sign-in code (ip = 'notify', not counted in the hourly limit).
 */
export async function magicLink(db: D1Database, rawEmail: string, next: string, days = 3) {
  const email = normEmail(rawEmail), token = randomToken();
  await db.prepare("INSERT INTO auth_codes (id, email, code_hash, token_hash, expires_at, ip) VALUES (?, ?, ?, ?, ?, 'notify')")
    .bind(uuid(), email, await sha256(randomToken()), await sha256(token), inMinutes(days * 24 * 60)).run();
  return `${await origin()}/login/link?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
}

// ---------- sessions ----------

export async function createSession(db: D1Database, userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const h = await headers();
  const org = await db.prepare(
    `SELECT m.org_id FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.status = 'active' DESC, m.created_at LIMIT 1`,
  ).bind(userId).first<{ org_id: string }>();
  const id = uuid();
  await db.prepare("INSERT INTO sessions (id, token_hash, user_id, org_id, ip, country, city, user_agent, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, await sha256(token), userId, org?.org_id ?? null, await clientIp(), h.get("cf-ipcountry"), h.get("cf-ipcity"), (h.get("user-agent") ?? "").slice(0, 300), now(), expires.toISOString())
    .run();
  await db.prepare("UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?").bind(now(), now(), userId).run();
  await db.prepare("INSERT INTO events (user_id, org_id, session_id, module, action) VALUES (?, ?, ?, 'auth', 'login')").bind(userId, org?.org_id ?? null, id).run();
  return { name: COOKIE, value: token, httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", expires };
}

export type Session = { id: string; user_id: string; org_id: string | null; created_at: string; last_seen_at: string | null };

/** The signed-in user and their session, or null. Refreshes "last seen" at most every 5 minutes. */
export async function currentSession(db: D1Database): Promise<{ user: User; session: Session } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db
    .prepare("SELECT id, user_id, org_id, created_at, last_seen_at FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?")
    .bind(await sha256(token), now())
    .first<Session>();
  if (!s) return null;
  const user = await getUser(db, s.user_id);
  if (!user || user.status !== "active") return null;
  if (!s.last_seen_at || Date.now() - new Date(s.last_seen_at).getTime() > 5 * 60_000) {
    const t = now();
    await db.batch([
      db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(t, s.id),
      db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(t, user.id),
    ]);
  }
  return { user, session: s };
}

export async function endSession(db: D1Database) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(now(), await sha256(token)).run();
}

export async function revokeSessions(db: D1Database, userId: string, exceptId?: string) {
  await db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id <> ?").bind(now(), userId, exceptId ?? "").run();
}

// ---------- invitations ----------

/** Invites someone into a firm (or as a UVALO super-admin when orgId is null). Creates the account if needed. */
/** `approved` = the account comes from an approved account request (the email says so, without the name of who approved it). */
export async function invite(db: D1Database, by: User, orgId: string | null, rawEmail: string, role: "owner" | "admin" | "member", name?: string, approved = false) {
  const email = normEmail(rawEmail);
  let u = await findUser(db, email);
  if (!u) {
    const id = uuid();
    await db.prepare("INSERT INTO users (id, email, name, status, is_superadmin, created_by) VALUES (?, ?, ?, 'invited', ?, ?)").bind(id, email, (name ?? "").trim().slice(0, 120), orgId ? 0 : 1, by.id).run();
    u = (await getUser(db, id))!;
  } else if (!orgId && !u.is_superadmin) {
    await db.prepare("UPDATE users SET is_superadmin = 1 WHERE id = ?").bind(u.id).run();
  }
  if (orgId) {
    // An active user is added right away; a new one joins when accepting.
    await db.prepare(
      `INSERT INTO memberships (org_id, user_id, role, status) VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role, status = excluded.status, removed_at = NULL`,
    ).bind(orgId, u.id, role, "active").run();
  }
  await db.prepare("UPDATE invites SET cancelled_at = ? WHERE email = ? AND COALESCE(org_id, '') = ? AND accepted_at IS NULL AND cancelled_at IS NULL").bind(now(), email, orgId ?? "").run();
  const id = uuid();
  const token = randomToken();
  await db.prepare("INSERT INTO invites (id, org_id, email, role, token_hash, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, orgId, email, role, await sha256(token), by.id, inMinutes(INVITE_DAYS * 24 * 60)).run();
  await audit(db, by.id, "invite.create", orgId ? "org" : "platform", orgId ?? undefined, `${email} (${role})`);
  const sent = await sendInviteEmail(db, u, orgId, token, by, approved);
  return { userId: u.id, inviteId: id, sent, active: u.status === "active" };
}

async function sendInviteEmail(db: D1Database, u: User, orgId: string | null, token: string, by: User | null, approved = false) {
  const org = orgId ? await db.prepare("SELECT name FROM orgs WHERE id = ?").bind(orgId).first<{ name: string }>() : null;
  const active = u.status === "active";
  const link = active ? `${await origin()}/login` : `${await origin()}/invitatie?token=${encodeURIComponent(token)}`;
  const hello = u.name?.trim() ? `Bună ziua, ${greetName(u.name)}!` : "Bună ziua!";
  if (approved) {
    // individual account: the firm is the person's own, so it is not named
    const own = !org || (await db.prepare("SELECT 1 FROM memberships WHERE org_id = ? AND user_id <> ?").bind(orgId, u.id).first()) === null;
    const firm = own ? "" : `, în contul firmei ${org!.name}`;
    const p = (t: string) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A">${t}</p>`;
    return sendEmail({
      to: u.email,
      subject: "Solicitarea ta de cont UVALO a fost aprobată",
      text: `${hello}\nSolicitarea ta de cont în UVALO a fost acceptată${firm}.\nActivează contul ca să începi să folosești instrumentele pentru evaluatori: ${link}\nNu ai nevoie de parolă: te autentifici cu un cod primit pe email.${active ? "" : `\nLinkul de activare este valabil ${INVITE_DAYS} zile.`}`,
      html: layout({
        eyebrow: "Cont aprobat",
        title: `${hello} Contul tău UVALO a fost aprobat.`,
        body: p(`Solicitarea ta de cont în UVALO a fost acceptată${esc(firm)}. Activează contul ca să începi să folosești instrumentele pentru evaluatori: localizatorul cadastral, analiza amplasamentului, comparabilele și extensiile UVALO pentru Word și Chrome.`)
          + `<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Nu ai nevoie de parolă: te autentifici cu un cod primit pe email.</p>`,
        button: { label: active ? "Intră în UVALO →" : "Activează contul →", url: link },
        foot: `${active ? "" : `Linkul de activare este valabil ${INVITE_DAYS} zile. `}Ai primit acest email pentru că ai solicitat un cont UVALO. Întrebări: office@uvalo.ro.`,
      }),
    });
  }
  const where = org ? `în contul firmei <strong style="color:#111111">${esc(org.name)}</strong>` : "ca administrator UVALO";
  return sendEmail({
    to: u.email,
    subject: org ? `Invitație în UVALO — ${org.name}` : "Invitație în UVALO",
    text: `${hello}\n${by?.name || "Echipa UVALO"} te-a invitat în UVALO${org ? `, în contul firmei ${org.name}` : ""}: instrumente pentru evaluatori (localizator cadastral și altele).\n${active ? "Intră cu adresa ta" : "Activează contul"}: ${link}`,
    html: layout({
      eyebrow: "UVALO",
      title: `${hello} Ai fost invitat(ă) în UVALO.`,
      body: `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A">${esc(by?.name || "Echipa UVALO")} te-a invitat ${where}. Găsești acolo instrumentele UVALO pentru evaluatori: localizatorul cadastral (număr cadastral, topo, adresă, locația ta pe parcelă) și, în curând, analize de piață.</p>
<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Nu ai nevoie de parolă: te autentifici cu un cod primit pe email.</p>`,
      button: { label: active ? "Intră în UVALO →" : "Activează contul →", url: link },
      foot: active ? "Dacă nu te aștepți la acest email, îl poți ignora." : `Invitația este valabilă ${INVITE_DAYS} zile. Dacă nu te aștepți la acest email, îl poți ignora.`,
    }),
  });
}

export async function resendInvite(db: D1Database, inviteId: string, by: User | null) {
  const inv = await db.prepare("SELECT * FROM invites WHERE id = ? AND accepted_at IS NULL AND cancelled_at IS NULL").bind(inviteId).first<{ id: string; org_id: string | null; email: string }>();
  if (!inv) return false;
  const u = await findUser(db, inv.email);
  if (!u) return false;
  const token = randomToken();
  await db.prepare("UPDATE invites SET token_hash = ?, expires_at = ? WHERE id = ?").bind(await sha256(token), inMinutes(INVITE_DAYS * 24 * 60), inv.id).run();
  const approved = !!(await db.prepare("SELECT 1 FROM account_requests WHERE user_id = ? AND status = 'approved'").bind(u.id).first());
  return sendInviteEmail(db, u, inv.org_id, token, by, approved);
}

/** The invitation behind a link (for the acceptance page). */
export async function inviteByToken(db: D1Database, token: string) {
  return db
    .prepare(`SELECT i.id, i.email, i.org_id, i.role, o.name AS org_name, u.id AS user_id, u.name, u.phone, u.status, u.anevar_no, u.county FROM invites i
      JOIN users u ON u.email = i.email LEFT JOIN orgs o ON o.id = i.org_id
      WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.cancelled_at IS NULL AND i.expires_at > ?`)
    .bind(await sha256(token), now())
    .first<{ id: string; email: string; org_id: string | null; role: string; org_name: string | null; user_id: string; name: string; phone: string | null; status: string; anevar_no: string | null; county: string | null }>();
}

export async function acceptInvite(db: D1Database, token: string, name: string, phone: string | null, anevar: string | null, newsletter = false) {
  const inv = await inviteByToken(db, token);
  if (!inv) return null;
  // Name, card, county and specializations come from the ANEVAR list and are not changed by the user.
  const legit = inv.anevar_no ?? (anevar ? anevar.replace(/\D/g, "") : null);
  const m = legit ? await db.prepare("SELECT name, county, specs FROM anevar_members WHERE legit = ?").bind(legit).first<{ name: string; county: string | null; specs: string | null }>() : null;
  const t = now();
  await db.batch([
    db.prepare(`UPDATE users SET name = ?, phone = ?, anevar_no = COALESCE(?, anevar_no), county = COALESCE(?, county), specs = COALESCE(?, specs),
        status = CASE WHEN status = 'disabled' THEN status ELSE 'active' END, closed_at = NULL, activated_at = COALESCE(activated_at, ?), terms_at = ?,
        newsletter = ?, newsletter_at = ? WHERE id = ?`)
      .bind(m?.name ?? (inv.anevar_no ? inv.name : name), phone, m ? legit : null, m?.county ?? null, m?.specs ?? null, t, t, newsletter ? 1 : 0, t, inv.user_id),
    db.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").bind(t, inv.id),
  ]);
  await audit(db, inv.user_id, "invite.accept", inv.org_id ? "org" : "platform", inv.org_id ?? undefined, inv.email);
  const u = await getUser(db, inv.user_id);
  return u && u.status === "active" ? u : null;
}
