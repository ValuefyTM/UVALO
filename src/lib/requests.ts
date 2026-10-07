// Server-only: ANEVAR list lookups and account requests (ask → VALUEFY approves → invitation by email).
import { headers } from "next/headers";
import { now, uuid } from "./db";
import { audit, findUser, invite, type User } from "./auth";
import { normEmail, validEmail } from "./crypto";
import { esc, layout, sendEmail } from "./email";
import { origin } from "./site";
import { seatsUsed } from "./access";
import { getOrg } from "./orgs";

export type Member = { legit: string; name: string; county: string | null; specs: string | null; in_current: number; tablou_date: string | null };

export const SPEC_LABEL: Record<string, string> = {
  EI: "Întreprinderi", EPI: "Bunuri imobile", EBM: "Bunuri mobile", EIF: "Instrumente financiare",
  "VE-EI": "Verificare EI", "VE-EPI": "Verificare EPI", "VE-EBM": "Verificare EBM", "VE-EIF": "Verificare EIF",
};

export const cleanLegit = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "").slice(0, 7) : "");
export const memberByLegit = (db: D1Database, legit: string) => db.prepare("SELECT * FROM anevar_members WHERE legit = ?").bind(legit).first<Member>();

async function ipUa() {
  const h = await headers();
  return { ip: h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, ua: (h.get("user-agent") ?? "").slice(0, 300) };
}

/** Lookups from one address are limited (the list is public, but not to be scraped through us). */
async function tooMany(db: D1Database, ip: string | null) {
  if (!ip) return false;
  const r = await db.prepare("SELECT COUNT(*) AS n FROM events WHERE module = 'public' AND action = 'lookup' AND target = ? AND at > ?")
    .bind(ip, new Date(Date.now() - 3600_000).toISOString()).first<{ n: number }>();
  return (r?.n ?? 0) >= 40;
}

export type Lookup =
  | { status: "ok"; name: string; county: string | null; specs: string | null }
  | { status: "has_account" | "pending"; name: string }
  | { status: "not_found" | "too_many" };

export async function lookup(db: D1Database, legitRaw: unknown): Promise<Lookup> {
  const { ip } = await ipUa();
  if (await tooMany(db, ip)) return { status: "too_many" };
  await db.prepare("INSERT INTO events (module, action, target, meta) VALUES ('public', 'lookup', ?, ?)").bind(ip, JSON.stringify({ legit: cleanLegit(legitRaw) })).run();
  const legit = cleanLegit(legitRaw);
  const m = legit ? await memberByLegit(db, legit) : null;
  if (!m) return { status: "not_found" };
  const u = await db.prepare("SELECT id FROM users WHERE anevar_no = ? AND status <> 'disabled'").bind(legit).first();
  if (u) return { status: "has_account", name: m.name };
  const p = await db.prepare("SELECT id FROM account_requests WHERE legit = ? AND status = 'pending'").bind(legit).first();
  if (p) return { status: "pending", name: m.name };
  return { status: "ok", name: m.name, county: m.county, specs: m.specs };
}

export async function createRequest(db: D1Database, b: Record<string, unknown>) {
  const s = (k: string, max = 160) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const found = await lookup(db, b.legit);
  if (found.status === "too_many") return { ok: false as const, error: "Prea multe încercări. Reîncearcă peste o oră." };
  if (found.status === "not_found") return { ok: false as const, error: "Nu găsim legitimația în tabloul ANEVAR." };
  if (found.status === "has_account") return { ok: false as const, error: "Există deja un cont pentru această legitimație. Intră cu adresa de email a contului." };
  if (found.status === "pending") return { ok: false as const, error: "Ai deja o solicitare în așteptare. Te anunțăm pe email când este aprobată." };
  const l = found as Extract<Lookup, { status: "ok" }>;
  const email = normEmail(s("email"));
  if (!validEmail(email)) return { ok: false as const, error: "Adresa de email nu pare validă." };
  if (b.confirm !== true) return { ok: false as const, error: `Confirmă că ești ${l.name}.` };
  const taken = await findUser(db, email);
  if (taken && taken.status !== "disabled") return { ok: false as const, error: "Adresa de email are deja cont. Intră cu ea sau folosește altă adresă." };
  const { ip, ua } = await ipUa();
  const id = uuid();
  const legit = cleanLegit(b.legit);
  await db.prepare("INSERT INTO account_requests (id, legit, name, email, phone, company, message, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, legit, l.name, email, s("phone", 40) || null, s("company") || null, s("message", 1000) || null, ip, ua).run();
  await db.prepare("INSERT INTO events (module, action, target, meta) VALUES ('public', 'request', ?, ?)").bind(legit, JSON.stringify({ email })).run();

  const base = await origin();
  await sendEmail({
    to: email,
    subject: "Am primit solicitarea ta de cont VALUEFY Tools",
    text: `Bună ziua, ${l.name}!\nAm primit solicitarea de cont în VALUEFY Tools pentru legitimația ANEVAR ${legit}. După aprobare primești pe această adresă linkul de activare.`,
    html: layout({
      eyebrow: "VALUEFY Tools", title: `Bună ziua, ${l.name}!`,
      body: `<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Am primit solicitarea de cont în VALUEFY Tools pentru legitimația ANEVAR <strong style="color:#111111">${esc(legit)}</strong>. După aprobare primești pe această adresă linkul de activare.</p>`,
      foot: "Dacă nu ai cerut tu contul, ignoră acest email.",
    }),
  });
  // Tell the VALUEFY administrators.
  const { results: admins } = await db.prepare("SELECT email FROM users WHERE is_superadmin = 1 AND status = 'active'").all<{ email: string }>();
  for (const a of admins) {
    await sendEmail({
      to: a.email,
      subject: `Solicitare de cont: ${l.name} (${legit})`,
      text: `${l.name}, legitimația ANEVAR ${legit}${l.county ? `, ${l.county}` : ""}, cere cont în VALUEFY Tools cu adresa ${email}.\nAprobă sau respinge: ${base}/admin/solicitari`,
      html: layout({
        eyebrow: "VALUEFY Tools · Admin", title: "Solicitare nouă de cont",
        body: `<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A"><strong style="color:#111111">${esc(l.name)}</strong>, legitimația ANEVAR ${esc(legit)}${l.county ? `, ${esc(l.county)}` : ""}, cere cont cu adresa ${esc(email)}.</p>`,
        button: { label: "Vezi solicitările →", url: `${base}/admin/solicitari` },
        foot: "Primești acest email ca administrator VALUEFY Tools.",
      }),
    });
  }
  return { ok: true as const, name: l.name };
}

export type RequestRow = {
  id: string; legit: string; name: string; email: string; phone: string | null; company: string | null; message: string | null; status: string;
  created_at: string; decided_at: string | null; decision_note: string | null; decided_by_name: string | null; county: string | null; specs: string | null; in_current: number | null;
};

export async function listRequests(db: D1Database, status: "pending" | "done") {
  const { results } = await db
    .prepare(`SELECT r.*, m.county, m.specs, m.in_current, COALESCE(NULLIF(u.name, ''), u.email) AS decided_by_name FROM account_requests r
      LEFT JOIN anevar_members m ON m.legit = r.legit LEFT JOIN users u ON u.id = r.decided_by
      WHERE ${status === "pending" ? "r.status = 'pending'" : "r.status <> 'pending'"} ORDER BY r.created_at ${status === "pending" ? "ASC" : "DESC"} LIMIT 300`)
    .all<RequestRow>();
  return results;
}

/**
 * Approves a request: the account (name, card, county and specializations from the ANEVAR list) goes into an
 * individual account with the chosen plan, or into an existing firm, and gets the activation link by email.
 */
export async function approve(db: D1Database, by: User, id: string, b: Record<string, unknown>) {
  const r = await db.prepare("SELECT * FROM account_requests WHERE id = ? AND status = 'pending'").bind(id).first<RequestRow>();
  if (!r) return "Solicitarea nu mai este în așteptare.";
  const m = await memberByLegit(db, r.legit);
  const plan = typeof b.plan_id === "string" && b.plan_id ? b.plan_id : "trial";
  if (!(await db.prepare("SELECT 1 AS x FROM plans WHERE id = ?").bind(plan).first())) return "Plan necunoscut.";
  const until = typeof b.valid_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.valid_until) ? b.valid_until : null;
  let orgId = typeof b.org === "string" && b.org ? b.org : null;
  if (orgId) {
    const org = await getOrg(db, orgId);
    if (!org) return "Firma aleasă nu există.";
    if ((await seatsUsed(db, orgId)) >= org.seats) return `Firma ${org.name} nu mai are locuri libere.`;
  } else {
    orgId = uuid();
    await db.prepare("INSERT INTO orgs (id, name, plan_id, seats, valid_until, billing_email, created_by, notes) VALUES (?, ?, ?, 1, ?, ?, ?, ?)")
      .bind(orgId, r.company?.trim() || r.name, plan, until, r.email, by.id, `Cont individual, din solicitarea ${r.legit}`).run();
    await audit(db, by.id, "org.create", "org", orgId, `${r.name} · ${plan} · cont individual`);
  }
  const inv = await invite(db, by, orgId, r.email, b.org ? "member" : "owner", r.name);
  await db.batch([
    db.prepare("UPDATE users SET name = ?, anevar_no = ?, county = ?, specs = ?, phone = COALESCE(phone, ?) WHERE id = ?")
      .bind(m?.name ?? r.name, r.legit, m?.county ?? null, m?.specs ?? null, r.phone, inv.userId),
    db.prepare("UPDATE account_requests SET status = 'approved', decided_by = ?, decided_at = ?, decision_note = ?, user_id = ? WHERE id = ?")
      .bind(by.id, now(), typeof b.note === "string" ? b.note.slice(0, 500) : null, inv.userId, id),
  ]);
  await audit(db, by.id, "request.approve", "user", inv.userId, `${r.name} (${r.legit})`);
  return null;
}

export async function reject(db: D1Database, by: User, id: string, note: string, notify: boolean) {
  const r = await db.prepare("SELECT * FROM account_requests WHERE id = ? AND status = 'pending'").bind(id).first<RequestRow>();
  if (!r) return "Solicitarea nu mai este în așteptare.";
  await db.prepare("UPDATE account_requests SET status = 'rejected', decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?").bind(by.id, now(), note.slice(0, 500) || null, id).run();
  await audit(db, by.id, "request.reject", "request", id, `${r.name} (${r.legit})${note ? `: ${note}` : ""}`);
  if (notify) {
    await sendEmail({
      to: r.email,
      subject: "Solicitarea ta de cont VALUEFY Tools",
      text: `Bună ziua, ${r.name}!\nDeocamdată nu putem activa contul solicitat în VALUEFY Tools.${note ? `\n${note}` : ""}\nPentru detalii, scrie-ne la office@valuefy.ro.`,
      html: layout({
        eyebrow: "VALUEFY Tools", title: `Bună ziua, ${r.name}!`,
        body: `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A">Deocamdată nu putem activa contul solicitat în VALUEFY Tools.</p>${note ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A">${esc(note)}</p>` : ""}<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Pentru detalii, scrie-ne la office@valuefy.ro.</p>`,
        foot: "VALUEFY · firmă autorizată ANEVAR",
      }),
    });
  }
  return null;
}
