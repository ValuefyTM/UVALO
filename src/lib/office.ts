// Server-only: "Birou de evaluare". The administration turns it on for chosen accounts (users.office_allowed); the person
// activates it from "Contul meu" with the office details and then manages the office's people in "Firma mea".
import { now, uuid } from "./db";
import { audit } from "./auth";
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
