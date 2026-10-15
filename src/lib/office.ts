// Server-only: "Birou de evaluare". The administration turns it on for chosen accounts (users.office_allowed); the person
// activates it from "Contul meu" with the office details and then manages the office's people in "Firma mea".
import { now, uuid } from "./db";
import { audit } from "./auth";
import { esc, greetName, layout, sendEmail } from "./email";
import { origin } from "./site";
import { canManageOrg, type Ctx } from "./access";

/** Seats an office gets at activation (more from Admin → Firme). */
export const OFFICE_SEATS = 5;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** The office details from the form: name, corporate member (+ authorization number), description, logo (data URL). */
type Details = { name: string; corporate: number; corp_no: string | null; description: string | null; logo: string | null | undefined };
function details(b: Record<string, unknown>): Details | { error: string } {
  const name = text(b.name, 120);
  if (name.length < 2) return { error: "Scrie denumirea firmei." };
  const corporate = b.corporate === true;
  const corp_no = corporate ? text(b.corp_no, 40) : "";
  if (corporate && !corp_no) return { error: "Scrie numărul autorizației de membru corporativ ANEVAR." };
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 600) : "";
  let logo: string | null | undefined; // undefined = unchanged, null = removed
  if (b.logo === null || b.logo === "") logo = null;
  else if (typeof b.logo === "string") {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.logo)) return { error: "Logo-ul trebuie să fie o imagine PNG, JPG sau WebP." };
    if (b.logo.length > 400_000) return { error: "Logo-ul este prea mare (cel mult 300 KB)." };
    logo = b.logo;
  }
  return { name, corporate: corporate ? 1 : 0, corp_no: corp_no || null, description: description || null, logo };
}

/**
 * Activates the office (or saves its details when already active): the firm the person runs now gets the details, at least
 * OFFICE_SEATS seats and "Firma mea"; without a firm they run, a new one is created with them as owner.
 */
export async function saveOffice(db: D1Database, c: Ctx, b: Record<string, unknown>): Promise<{ error: string } | { ok: true; org_id: string; first: boolean }> {
  if (!c.office) return { error: "Funcția de birou este în testare. Te anunțăm când se lansează." };
  const d = details(b);
  if ("error" in d) return { error: d.error };
  const t = now();
  let orgId = c.org && canManageOrg(c) ? c.org.id : null;
  if (!orgId) {
    orgId = uuid();
    await db.batch([
      db.prepare("INSERT INTO orgs (id, name, plan_id, seats, billing_email, created_by, notes) VALUES (?, ?, 'trial', ?, ?, ?, 'Birou de evaluare, activat din cont')")
        .bind(orgId, d.name, OFFICE_SEATS, c.user.email, c.user.id),
      db.prepare("INSERT INTO memberships (org_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')").bind(orgId, c.user.id),
      db.prepare("UPDATE sessions SET org_id = ? WHERE id = ?").bind(orgId, c.session.id),
    ]);
  }
  const first = !c.user.is_office || !c.org?.office_at;
  await db.batch([
    db.prepare(`UPDATE orgs SET name = ?, corporate = ?, corp_no = ?, description = ?, ${d.logo !== undefined ? "logo = ?," : ""} seats = MAX(seats, ?),
        office_at = COALESCE(office_at, ?), updated_at = ? WHERE id = ?`)
      .bind(...[d.name, d.corporate, d.corp_no, d.description, ...(d.logo !== undefined ? [d.logo] : []), OFFICE_SEATS, t, t, orgId]),
    db.prepare("UPDATE users SET is_office = 1 WHERE id = ?").bind(c.user.id),
  ]);
  await audit(db, c.user.id, first ? "office.activate" : "office.update", "org", orgId, `${d.name}${d.corporate ? ` · membru corporativ ${d.corp_no}` : ""}`);
  return { ok: true as const, org_id: orgId, first };
}

/* ---------- leaving an office for an individual account ---------- */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1);

export type LeaveRow = { id: string; org_id: string; user_id: string; legit: string; status: string; created_at: string };

/** The pending request of this person to leave the firm they work in now. */
export const pendingLeave = (db: D1Database, userId: string, orgId: string) =>
  db.prepare("SELECT * FROM office_leaves WHERE user_id = ? AND org_id = ? AND status = 'pending'").bind(userId, orgId).first<LeaveRow>();

export async function admins(db: D1Database, orgId: string) {
  const { results } = await db.prepare(`SELECT u.email, u.name FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ? AND m.status = 'active' AND m.role IN ('owner', 'admin') AND u.status = 'active'`).bind(orgId).all<{ email: string; name: string }>();
  return results;
}

/**
 * A member asks to leave the office and continue with an individual account. Only valuers: the ANEVAR card must be in the
 * Tablou, not used by another account and (when the account has a name) carry the same name. The administrators get an email.
 */
export async function requestLeave(db: D1Database, c: Ctx, legitRaw: unknown) {
  if (!c.org) return { error: "Nu faci parte din niciun birou." };
  if (canManageOrg(c) && !c.super) return { error: "Ești administratorul biroului. Ca să ieși, numește întâi alt titular din „Firma mea” sau scrie-ne la office@uvalo.ro." };
  if (await pendingLeave(db, c.user.id, c.org.id)) return { error: "Ai trimis deja cererea. Așteaptă răspunsul administratorului biroului." };
  const legit = (c.user.anevar_no?.trim() || (typeof legitRaw === "string" ? legitRaw : "")).replace(/\D/g, "").slice(0, 7);
  if (!legit) return { error: "Scrie numărul legitimației ANEVAR. Contul individual în UVALO este doar pentru evaluatori." };
  const m = await db.prepare("SELECT legit, name FROM anevar_members WHERE legit = ?").bind(legit).first<{ legit: string; name: string }>();
  if (!m) return { error: "Nu găsim legitimația în Tabloul ANEVAR. Verifică numărul." };
  const other = await db.prepare("SELECT 1 FROM users WHERE anevar_no = ? AND id <> ? AND status NOT IN ('disabled', 'closed')").bind(legit, c.user.id).first();
  if (other) return { error: "Legitimația este folosită deja de alt cont UVALO. Scrie-ne la office@uvalo.ro." };
  if (c.user.name?.trim() && !c.user.anevar_no) {
    const a = new Set(norm(m.name)), b = norm(c.user.name);
    if (!b.some((w) => a.has(w))) return { error: "Numele din Tabloul ANEVAR pentru această legitimație nu se potrivește cu numele contului tău. Scrie-ne la office@uvalo.ro." };
  }
  const id = uuid();
  await db.prepare("INSERT INTO office_leaves (id, org_id, user_id, legit) VALUES (?, ?, ?, ?)").bind(id, c.org.id, c.user.id, legit).run();
  await audit(db, c.user.id, "office.leave_request", "org", c.org.id, `${m.name} (${legit})`);
  const who = c.user.name?.trim() || m.name;
  const link = `${await origin()}/firma`;
  for (const a of await admins(db, c.org.id)) {
    await sendEmail({
      to: a.email,
      subject: `${who} vrea să iasă din biroul ${c.org.name}`,
      text: `${who} (legitimație ANEVAR ${legit}) a cerut să iasă din biroul ${c.org.name} și să continue în UVALO cu un cont individual.\nCererea o aprobi sau o respingi din „Firma mea”: ${link}`,
      html: layout({
        eyebrow: "Birou de evaluare", title: `${who} vrea să iasă din birou`,
        body: `<p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#4A4A4A"><b>${esc(who)}</b> (legitimație ANEVAR ${esc(legit)}, verificată în Tablou) a cerut să iasă din biroul <b>${esc(c.org.name)}</b> și să continue în UVALO cu un cont individual.</p><p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Când aprobi, persoana iese din birou (locul se eliberează) și primește contul individual. Istoricul rămâne.</p>`,
        button: { label: "Vezi cererea în Firma mea →", url: link },
        foot: "Primești acest email pentru că administrezi biroul în UVALO.",
      }),
    });
  }
  return { ok: true as const };
}

export async function cancelLeave(db: D1Database, c: Ctx) {
  if (!c.org) return { error: "Nu faci parte din niciun birou." };
  await db.prepare("UPDATE office_leaves SET status = 'cancelled', decided_at = ? WHERE user_id = ? AND org_id = ? AND status = 'pending'").bind(now(), c.user.id, c.org.id).run();
  return { ok: true as const };
}

/** The office's administrator approves (removes the person and creates their individual account) or rejects the request. */
export async function decideLeave(db: D1Database, c: Ctx, id: string, approve: boolean) {
  const r = await db.prepare("SELECT * FROM office_leaves WHERE id = ? AND status = 'pending'").bind(id).first<LeaveRow>();
  if (!r) return { error: "Cererea nu mai este în așteptare." };
  if (!c.super && !(c.org?.id === r.org_id && canManageOrg(c))) return { error: "Doar administratorii biroului pot face asta." };
  const [u, m, org] = await Promise.all([
    db.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(r.user_id).first<{ id: string; email: string; name: string }>(),
    db.prepare("SELECT name, county, specs FROM anevar_members WHERE legit = ?").bind(r.legit).first<{ name: string; county: string | null; specs: string | null }>(),
    db.prepare("SELECT name FROM orgs WHERE id = ?").bind(r.org_id).first<{ name: string }>(),
  ]);
  if (!u || !org) return { error: "Contul sau biroul nu mai există." };
  const t = now();
  if (!approve) {
    await db.prepare("UPDATE office_leaves SET status = 'rejected', decided_by = ?, decided_at = ? WHERE id = ?").bind(c.user.id, t, id).run();
    await audit(db, c.user.id, "office.leave_reject", "org", r.org_id, u.email);
    await sendEmail({
      to: u.email, subject: `Cererea de ieșire din biroul ${org.name}`,
      text: `Administratorul biroului ${org.name} nu a aprobat deocamdată ieșirea ta din birou. Pentru detalii, vorbește cu el.`,
      html: layout({ eyebrow: "Birou de evaluare", title: "Cererea de ieșire din birou", body: `<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Administratorul biroului <b>${esc(org.name)}</b> nu a aprobat deocamdată ieșirea ta din birou. Pentru detalii, vorbește cu el.</p>`, foot: "UVALO · platformă pentru evaluatori" }),
    });
    return { ok: true as const };
  }
  const orgId = uuid();
  await db.batch([
    db.prepare("UPDATE memberships SET status = 'removed', removed_at = ? WHERE org_id = ? AND user_id = ?").bind(t, r.org_id, u.id),
    db.prepare("INSERT INTO orgs (id, name, plan_id, seats, billing_email, created_by, notes) VALUES (?, ?, 'trial', 1, ?, ?, ?)")
      .bind(orgId, greetName(m?.name) || u.name || u.email, u.email, c.user.id, `Cont individual, la ieșirea din biroul ${org.name}`),
    db.prepare("INSERT INTO memberships (org_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')").bind(orgId, u.id),
    db.prepare("UPDATE sessions SET org_id = ? WHERE user_id = ? AND org_id = ?").bind(orgId, u.id, r.org_id),
    db.prepare("UPDATE users SET anevar_no = ?, name = COALESCE(NULLIF(name, ''), ?), county = COALESCE(county, ?), specs = COALESCE(specs, ?), is_office = 0 WHERE id = ?")
      .bind(r.legit, m?.name ?? null, m?.county ?? null, m?.specs ?? null, u.id),
    db.prepare("UPDATE office_leaves SET status = 'done', decided_by = ?, decided_at = ?, new_org_id = ? WHERE id = ?").bind(c.user.id, t, orgId, id),
  ]);
  await audit(db, c.user.id, "office.leave_approve", "org", r.org_id, `${u.email} → cont individual ${orgId}`);
  await sendEmail({
    to: u.email, subject: "Ai acum cont individual în UVALO",
    text: `Ai ieșit din biroul ${org.name}. Contul tău UVALO continuă ca cont individual, cu aceeași adresă de email: ${await origin()}/`,
    html: layout({
      eyebrow: "Cont individual", title: "Ai acum cont individual în UVALO",
      body: `<p style="margin:0;font-size:15px;line-height:1.65;color:#4A4A4A">Administratorul a aprobat ieșirea ta din biroul <b>${esc(org.name)}</b>. Contul tău continuă ca cont individual, cu aceeași adresă de email și cu istoricul tău.</p>`,
      button: { label: "Intră în UVALO →", url: `${await origin()}/` }, foot: "UVALO · platformă pentru evaluatori",
    }),
  });
  return { ok: true as const };
}

/** Pending requests to leave this firm ("Firma mea"). */
export async function leaveRequests(db: D1Database, orgId: string) {
  const { results } = await db.prepare(`SELECT l.id, l.legit, l.created_at, u.name, u.email, a.name AS tablou_name FROM office_leaves l JOIN users u ON u.id = l.user_id
    LEFT JOIN anevar_members a ON a.legit = l.legit WHERE l.org_id = ? AND l.status = 'pending' ORDER BY l.created_at`).bind(orgId)
    .all<{ id: string; legit: string; created_at: string; name: string; email: string; tablou_name: string | null }>();
  return results;
}
