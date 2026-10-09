// Server components: load the signed-in person or send them to the sign-in page.
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { maintenance } from "./maintenance";
import { canManageOrg, context, OFFICE_READY, type Ctx } from "./access";

export async function page(): Promise<{ db: D1Database; c: Ctx }> {
  const db = await getDb();
  if (!db) throw new Error("Baza de date nu este disponibilă.");
  const c = await context(db);
  if (!c) redirect("/login");
  if (!c.super && (await maintenance(db)).on) redirect("/mentenanta");
  return { db, c };
}

/** VALUEFY administration portal; also the number of account requests waiting (menu badge). */
export async function superPage() {
  const r = await page();
  if (!r.c.super) redirect("/");
  const p = await r.db.prepare("SELECT COUNT(*) AS n FROM account_requests WHERE status = 'pending'").first<{ n: number }>();
  return { ...r, pending: p?.n ?? 0 };
}

export async function orgAdminPage() {
  const r = await page();
  if (!r.c.org || !canManageOrg(r.c)) redirect("/");
  if (!r.c.super && (!OFFICE_READY || !r.c.user.is_office)) redirect("/cont"); // "Firma mea" is turned on from the account ("Lucrez ca birou")
  return r;
}

export const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleString("ro-RO", withTime ? { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Bucharest" } : { dateStyle: "medium", timeZone: "Europe/Bucharest" }) : "—";

export const initials = (name: string, email: string) =>
  (name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") : email[0]).toUpperCase();

/**
 * First name for the greeting. The ANEVAR list writes "Surname Given names": for valuers from the list (card number,
 * or the name found in the list) the first name is the second word. For other names, the word that is more often a
 * surname in the list is taken as the surname ("Stan Bogdan" → Bogdan, "Bogdan Stan" → Bogdan); otherwise the first word.
 */
export async function firstName(db: D1Database, name: string, legit: string | null) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length < 2) return w[0] ?? "";
  if (legit) return w[1];
  const r = await db.prepare(`SELECT
      EXISTS (SELECT 1 FROM anevar_members WHERE name = ?1 COLLATE NOCASE OR name LIKE ?1 || ' %') AS listed,
      (SELECT COUNT(*) FROM anevar_members WHERE name LIKE ?2 || ' %') AS a,
      (SELECT COUNT(*) FROM anevar_members WHERE name LIKE ?3 || ' %') AS b`)
    .bind(w.join(" "), w[0], w[w.length - 1]).first<{ listed: number; a: number; b: number }>();
  if (r?.listed || (r && r.a > r.b)) return w[1];
  return w[0];
}
