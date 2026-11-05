// Suport tehnic: the messages from the feedback button and from /suport are tickets (table `feedback`) with a thread of replies
// (`feedback_replies`: the person and the UVALO team) and an optional image (R2 `FILES`, key support/…). Admin → Feedback answers them.
import type { Ctx } from "./access";
import { now } from "./db";
import { esc, layout, sendEmail } from "./email";
import { origin } from "./site";
import { SUPPORT_KINDS } from "./support-shared";
export * from "./support-shared";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
export const IMAGE_MAX = 6 * 1024 * 1024;

export type Ticket = { id: number; user_id: string | null; kind: string; text: string; page: string | null; contact: number; status: string; note: string | null; image_key: string | null; created_at: string; updated_at: string | null; user_seen_at: string | null };
export type Reply = { id: number; user_id: string | null; staff: number; text: string; image_key: string | null; created_at: string; who: string | null };

/** Puts an image in the bucket (jpeg / png / webp / gif, ≤ 6 MB); `null` = no file; an error message for a bad file. */
export async function putImage(bucket: R2Bucket | null, prefix: string, f: unknown): Promise<{ key: string; type: string } | null | { error: string }> {
  if (!(f instanceof File) || f.size === 0) return null;
  const ext = IMAGE_TYPES[f.type];
  if (!ext) return { error: "Imaginea trebuie să fie JPG, PNG, WebP sau GIF." };
  if (f.size > IMAGE_MAX) return { error: "Imaginea e prea mare (maximum 6 MB)." };
  if (!bucket) return { error: "Stocarea fișierelor nu este configurată." };
  const key = `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await bucket.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
  return { key, type: f.type };
}

const cleanText = (t: unknown, max = 4000) => (typeof t === "string" ? t.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

/** A new ticket (from the floating button or from /suport); the UVALO administrators get an email. */
export async function createTicket(db: D1Database, bucket: R2Bucket | null, c: Ctx, ua: string, b: { kind?: unknown; text?: unknown; page?: unknown; contact?: unknown; image?: unknown }): Promise<{ id: number } | { error: string; status?: number }> {
  const text = cleanText(b.text);
  if (text.length < 3) return { error: "Scrie câteva cuvinte." };
  const kind = typeof b.kind === "string" && b.kind in SUPPORT_KINDS ? b.kind : "altceva";
  const page = typeof b.page === "string" ? b.page.slice(0, 300) : null;
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(c.user.id).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 10) return { error: "Ai trimis multe mesaje în ultima oră. Încearcă puțin mai târziu.", status: 429 };
  const img = await putImage(bucket, `support/t`, b.image);
  if (img && "error" in img) return img;
  const r = await db.prepare("INSERT INTO feedback (user_id, org_id, kind, text, page, ua, contact, image_key, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(c.user.id, c.org?.id ?? null, kind, text, page, ua.slice(0, 300), b.contact === false || b.contact === "0" ? 0 : 1, img?.key ?? null, img?.type ?? null).run();
  const id = Number(r.meta.last_row_id);
  await mailAdmins(db, c, { subject: `Feedback (${SUPPORT_KINDS[kind]}) de la ${c.user.name || c.user.email}`, title: `${SUPPORT_KINDS[kind]} de la ${c.user.name || c.user.email}`, text, page, id, image: !!img }).catch(() => {});
  return { id };
}

/** A reply in a ticket's thread: by the person (status back to „nou”, the admins get an email) or by the UVALO team (status „raspuns”, the person gets an email). */
export async function replyTicket(db: D1Database, bucket: R2Bucket | null, c: Ctx, id: number, b: { text?: unknown; image?: unknown }, staff: boolean): Promise<{ ok: true } | { error: string; status?: number }> {
  const t = await db.prepare("SELECT * FROM feedback WHERE id = ?").bind(id).first<Ticket>();
  if (!t || (!staff && t.user_id !== c.user.id)) return { error: "Sesizarea nu există.", status: 404 };
  const text = cleanText(b.text);
  if (text.length < 2) return { error: "Scrie mesajul." };
  const img = await putImage(bucket, `support/r`, b.image);
  if (img && "error" in img) return img;
  const at = now();
  await db.batch([
    db.prepare("INSERT INTO feedback_replies (feedback_id, user_id, staff, text, image_key, image_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, c.user.id, staff ? 1 : 0, text, img?.key ?? null, img?.type ?? null, at),
    staff
      ? db.prepare("UPDATE feedback SET status = CASE WHEN status = 'rezolvat' THEN 'rezolvat' ELSE 'raspuns' END, updated_at = ? WHERE id = ?").bind(at, id)
      : db.prepare("UPDATE feedback SET status = 'nou', updated_at = ?, user_seen_at = ? WHERE id = ?").bind(at, at, id),
  ]);
  if (staff) {
    const u = t.user_id ? await db.prepare("SELECT email, name FROM users WHERE id = ? AND status = 'active'").bind(t.user_id).first<{ email: string; name: string }>() : null;
    if (u && t.contact) {
      const base = await origin();
      await sendEmail({
        to: u.email, subject: "Echipa UVALO ți-a răspuns la sesizare",
        text: `Ai un răspuns de la echipa UVALO la sesizarea ta („${t.text.slice(0, 80)}”):\n\n${text}\n\nVezi firul și răspunde: ${base}/suport/${id}`,
        html: layout({ eyebrow: "UVALO · Suport tehnic", title: "Echipa UVALO ți-a răspuns",
          body: `<p style="margin:0 0 10px;font-size:13px;color:#6B6B6B">La sesizarea ta: „${esc(t.text.slice(0, 120))}${t.text.length > 120 ? "…" : ""}”</p><p style="margin:0;font-size:15px;line-height:1.65;color:#141414;white-space:pre-wrap">${esc(text)}</p>${img ? `<p style="margin:10px 0 0;font-size:12px;color:#6B6B6B">+ o imagine atașată (o vezi în platformă)</p>` : ""}`,
          button: { label: "Vezi răspunsul și scrie înapoi →", url: `${base}/suport/${id}` }, foot: "Primești acest email pentru că ai trimis o sesizare din UVALO și ai acceptat răspuns pe email." }),
      }).catch(() => false);
    }
  } else {
    await mailAdmins(db, c, { subject: `Răspuns la sesizarea #${id} de la ${c.user.name || c.user.email}`, title: `${c.user.name || c.user.email} a scris în sesizarea #${id}`, text, page: null, id, image: !!img }).catch(() => {});
  }
  return { ok: true };
}

async function mailAdmins(db: D1Database, c: Ctx, m: { subject: string; title: string; text: string; page: string | null; id: number; image: boolean }) {
  const base = await origin();
  const { results: admins } = await db.prepare("SELECT email FROM users WHERE is_superadmin = 1 AND status = 'active'").all<{ email: string }>();
  for (const x of admins) {
    await sendEmail({
      to: x.email, subject: m.subject,
      text: `${c.user.name || c.user.email} (${c.user.email}${c.org ? `, ${c.org.name}` : ""})${m.page ? `, din ${m.page}` : ""}:\n\n${m.text}\n\nRăspunde: ${base}/admin/feedback/${m.id}`,
      html: layout({ eyebrow: "UVALO · Suport tehnic", title: m.title,
        body: `<p style="margin:0 0 10px;font-size:13px;color:#6B6B6B">${esc(c.user.email)}${c.org ? ` · ${esc(c.org.name)}` : ""}${m.page ? ` · ${esc(m.page)}` : ""}</p><p style="margin:0;font-size:15px;line-height:1.65;color:#141414;white-space:pre-wrap">${esc(m.text)}</p>${m.image ? `<p style="margin:10px 0 0;font-size:12px;color:#6B6B6B">+ o imagine atașată</p>` : ""}`,
        button: { label: "Deschide și răspunde →", url: `${base}/admin/feedback/${m.id}` }, foot: "Primești acest email ca administrator UVALO." }),
    }).catch(() => false);
  }
}

/** The person's tickets, newest activity first, with „răspuns nou” when the team wrote after they last opened it. */
export async function myTickets(db: D1Database, userId: string) {
  const { results } = await db.prepare(`SELECT f.id, f.kind, f.text, f.status, f.image_key, f.created_at, f.updated_at, f.user_seen_at,
      (SELECT COUNT(*) FROM feedback_replies r WHERE r.feedback_id = f.id) AS replies
    FROM feedback f WHERE f.user_id = ? ORDER BY COALESCE(f.updated_at, f.created_at) DESC LIMIT 200`).bind(userId)
    .all<Ticket & { replies: number }>();
  return results.map((t) => ({ ...t, unread: isUnread(t) }));
}

export const isUnread = (t: Pick<Ticket, "status" | "updated_at" | "user_seen_at">) => (t.status === "raspuns" || t.status === "rezolvat") && !!t.updated_at && (!t.user_seen_at || t.user_seen_at < t.updated_at);

/** Tickets with an answer the person has not opened yet (the count in the menu). */
export async function supportUnread(db: D1Database, userId: string): Promise<number> {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND status IN ('raspuns', 'rezolvat') AND updated_at IS NOT NULL AND (user_seen_at IS NULL OR user_seen_at < updated_at)").bind(userId).first<{ n: number }>().catch(() => null);
  return r?.n ?? 0;
}

/** One ticket with its thread: for its owner (marks it seen) or a super-admin. */
export async function ticket(db: D1Database, c: Ctx, id: number, opts: { admin?: boolean } = {}): Promise<{ t: Ticket & { who: string | null; email: string | null; org: string | null }; replies: Reply[] } | null> {
  if (!Number.isInteger(id)) return null;
  const t = await db.prepare("SELECT f.*, COALESCE(NULLIF(u.name, ''), u.email) AS who, u.email, o.name AS org FROM feedback f LEFT JOIN users u ON u.id = f.user_id LEFT JOIN orgs o ON o.id = f.org_id WHERE f.id = ?").bind(id)
    .first<Ticket & { who: string | null; email: string | null; org: string | null }>();
  if (!t) return null;
  if (opts.admin ? !c.super : t.user_id !== c.user.id) return null;
  const { results: replies } = await db.prepare("SELECT r.id, r.user_id, r.staff, r.text, r.image_key, r.created_at, COALESCE(NULLIF(u.name, ''), u.email) AS who FROM feedback_replies r LEFT JOIN users u ON u.id = r.user_id WHERE r.feedback_id = ? ORDER BY r.id").bind(id).all<Reply>();
  if (!opts.admin && !c.viewAs) await db.prepare("UPDATE feedback SET user_seen_at = ? WHERE id = ?").bind(now(), id).run();
  if (opts.admin && t.status === "nou" && !c.viewAs) await db.prepare("UPDATE feedback SET status = 'citit' WHERE id = ? AND status = 'nou'").bind(id).run();
  return { t, replies };
}

/** The image of a ticket (`f`) or of a reply (`r`): its owner or a super-admin. */
export async function ticketImage(db: D1Database, c: Ctx, kind: string, id: number): Promise<{ key: string; type: string } | null> {
  if (!Number.isInteger(id)) return null;
  const row = kind === "r"
    ? await db.prepare("SELECT r.image_key AS k, r.image_type AS t, f.user_id FROM feedback_replies r JOIN feedback f ON f.id = r.feedback_id WHERE r.id = ?").bind(id).first<{ k: string | null; t: string | null; user_id: string | null }>()
    : await db.prepare("SELECT image_key AS k, image_type AS t, user_id FROM feedback WHERE id = ?").bind(id).first<{ k: string | null; t: string | null; user_id: string | null }>();
  if (!row?.k || (!c.super && row.user_id !== c.user.id)) return null;
  return { key: row.k, type: row.t ?? "image/jpeg" };
}
