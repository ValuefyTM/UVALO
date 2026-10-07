// Server-only: recommendations. A user sends a colleague the link to "Solicită cont"; the colleague goes through
// the usual flow (ANEVAR card → approval → activation) and the administrators see who recommended whom and how far it got.
import { now, uuid } from "./db";
import { findUser, type User } from "./auth";
import { normEmail, randomToken, sha256, validEmail } from "./crypto";
import { esc, layout, sendEmail } from "./email";
import { origin } from "./site";

const PER_DAY = 20;

export async function recommend(db: D1Database, by: User, b: Record<string, unknown>) {
  const s = (k: string, max: number) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const email = normEmail(s("email", 160));
  const name = s("name", 120);
  const note = s("note", 600);
  if (!validEmail(email)) return { error: "Adresa de email nu pare validă." };
  if (email === by.email) return { error: "Introdu adresa colegului, nu pe a ta." };
  const u = await findUser(db, email);
  if (u && u.status !== "disabled") return { error: "Această adresă are deja cont în VALUEFY Tools." };
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [mine, again] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE by_user = ? AND created_at > ?").bind(by.id, dayAgo).first<{ n: number }>(),
    db.prepare("SELECT 1 AS x FROM referrals WHERE by_user = ? AND email = ? AND created_at > ?").bind(by.id, email, new Date(Date.now() - 7 * 86_400_000).toISOString()).first(),
  ]);
  if ((mine?.n ?? 0) >= PER_DAY) return { error: "Ai trimis multe recomandări azi. Reîncearcă mâine." };
  if (again) return { error: "Ai recomandat deja această adresă în ultimele 7 zile." };

  const token = randomToken();
  const id = uuid();
  await db.prepare("INSERT INTO referrals (id, by_user, email, name, note, token_hash) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, by.id, email, name || null, note || null, await sha256(token)).run();

  const who = by.name || by.email;
  const url = `${await origin()}/solicita-cont?r=${token}`;
  const hello = name ? `Bună ziua, ${name}!` : "Bună ziua!";
  const sent = await sendEmail({
    to: email,
    subject: `${who} îți recomandă VALUEFY Tools`,
    text: `${hello}\n${who}${by.anevar_no ? ` (legitimație ANEVAR ${by.anevar_no})` : ""} îți recomandă VALUEFY Tools: instrumente pentru evaluatorii autorizați ANEVAR, începând cu localizatorul cadastral.${note ? `\n\n„${note}”` : ""}\n\nSolicită cont cu numărul legitimației ANEVAR: ${url}\nDupă aprobare primești pe email linkul de activare.`,
    html: layout({
      eyebrow: "VALUEFY Tools", title: hello,
      body: `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A"><strong style="color:#111111">${esc(who)}</strong>${by.anevar_no ? ` (legitimație ANEVAR ${esc(by.anevar_no)})` : ""} îți recomandă VALUEFY Tools: instrumente pentru evaluatorii autorizați ANEVAR, începând cu localizatorul cadastral.</p>`
        + (note ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A;font-style:italic">„${esc(note)}”</p>` : "")
        + `<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Solicită cont cu numărul legitimației ANEVAR. După aprobare primești pe email linkul de activare.</p>`,
      button: { label: "Solicită cont →", url },
      foot: `Primești acest email pentru că ${esc(who)} te-a recomandat. Dacă nu te interesează, ignoră-l.`,
    }),
  });
  if (sent) await db.prepare("UPDATE referrals SET email_sent = 1 WHERE id = ?").bind(id).run();
  return { ok: true as const };
}

/** The recommendation behind a link (marks the first visit). */
export async function referralByToken(db: D1Database, token: string | null | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null;
  const r = await db.prepare(`SELECT r.id, r.email, r.name, COALESCE(NULLIF(u.name, ''), u.email) AS by_name FROM referrals r JOIN users u ON u.id = r.by_user WHERE r.token_hash = ?`)
    .bind(await sha256(token)).first<{ id: string; email: string; name: string | null; by_name: string }>();
  if (r) await db.prepare("UPDATE referrals SET opened_at = COALESCE(opened_at, ?) WHERE id = ?").bind(now(), r.id).run();
  return r;
}

export type ReferralRow = {
  id: string; email: string; name: string | null; note: string | null; created_at: string; opened_at: string | null; email_sent: number;
  by_id: string; by_name: string; by_email: string; by_legit: string | null;
  req_status: string | null; req_at: string | null; req_name: string | null; req_legit: string | null; decided_at: string | null;
  user_status: string | null; activated_at: string | null; last_seen_at: string | null;
};

/** Stage reached, from the request and the account (by link or by the same email). */
export function stage(r: ReferralRow): [string, string] {
  if (r.activated_at || r.user_status === "active") return ["Cont activ", "pillOk"];
  if (r.req_status === "approved") return ["Aprobat, neactivat", "pillWarn"];
  if (r.req_status === "rejected") return ["Respins", "pillErr"];
  if (r.req_status === "pending") return ["A solicitat cont", "pillInfo"];
  if (r.opened_at) return ["A deschis linkul", "pillWarn"];
  return [r.email_sent ? "Email trimis" : "Email netrimis", ""];
}

export async function listReferrals(db: D1Database) {
  const { results } = await db.prepare(`
    SELECT f.id, f.email, f.name, f.note, f.created_at, f.opened_at, f.email_sent,
      b.id AS by_id, COALESCE(NULLIF(b.name, ''), b.email) AS by_name, b.email AS by_email, b.anevar_no AS by_legit,
      q.status AS req_status, q.created_at AS req_at, q.name AS req_name, q.legit AS req_legit, q.decided_at,
      u.status AS user_status, u.activated_at, u.last_seen_at
    FROM referrals f JOIN users b ON b.id = f.by_user
    LEFT JOIN account_requests q ON q.id = (SELECT id FROM account_requests WHERE referral_id = f.id OR email = f.email ORDER BY (referral_id = f.id) DESC, created_at DESC LIMIT 1)
    LEFT JOIN users u ON u.id = COALESCE(q.user_id, (SELECT id FROM users WHERE email = f.email))
    ORDER BY f.created_at DESC LIMIT 500`).all<ReferralRow>();
  return results;
}
