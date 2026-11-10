import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { VIEW_COOKIE } from "@/lib/access";
import { err, json, str } from "@/lib/api";

/** Who really is signed in (not the person viewed): a super-admin, or null. */
async function realSuper(db: D1Database) {
  const s = await currentSession(db);
  return s && s.user.is_superadmin ? s.user : null;
}

/** The people a super-admin can look as (active accounts, with their firm). */
export async function GET() {
  const db = await getDb();
  if (!db) return err("Baza de date nu este disponibilă.", 503);
  if (!(await realSuper(db))) return err("Doar administratorii UVALO.", 403);
  const { results } = await db.prepare(`SELECT u.id, u.name, u.email, u.anevar_no, u.status, (SELECT o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active' ORDER BY o.name LIMIT 1) AS org
    FROM users u WHERE u.is_superadmin = 0 AND u.status IN ('active', 'closed', 'disabled') ORDER BY u.status = 'active' DESC, u.name, u.email`).all<{ id: string; name: string; email: string; anevar_no: string | null; status: string; org: string | null }>();
  return Response.json({ users: results });
}

/** `{ user_id }` → look as that person (cookie for 8 hours; worker.ts refuses every write while it is set). */
export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return err("Baza de date nu este disponibilă.", 503);
  const me = await realSuper(db);
  if (!me) return err("Doar administratorii UVALO.", 403);
  const id = str((await json(req)).user_id, 60);
  const u = id ? await db.prepare("SELECT id, name, email, is_superadmin FROM users WHERE id = ?").bind(id).first<{ id: string; name: string; email: string; is_superadmin: number }>() : null;
  if (!u) return err("Utilizatorul nu există.");
  if (u.is_superadmin) return err("Nu poți vedea platforma ca un alt administrator UVALO.");
  const res = NextResponse.json({ ok: true, user: { id: u.id, name: u.name || u.email } });
  res.cookies.set({ name: VIEW_COOKIE, value: u.id, httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 8 * 3600 });
  return res;
}

/** Back to the own account. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: VIEW_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
