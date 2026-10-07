// Server components: load the signed-in person or send them to the sign-in page.
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { canManageOrg, context, type Ctx } from "./access";

export async function page(): Promise<{ db: D1Database; c: Ctx }> {
  const db = await getDb();
  if (!db) throw new Error("Baza de date nu este disponibilă.");
  const c = await context(db);
  if (!c) redirect("/login");
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
  return r;
}

export const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleString("ro-RO", withTime ? { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Bucharest" } : { dateStyle: "medium", timeZone: "Europe/Bucharest" }) : "—";

export const initials = (name: string, email: string) =>
  (name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") : email[0]).toUpperCase();
