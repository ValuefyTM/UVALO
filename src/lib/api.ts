// Server-only helpers for route handlers.
import { NextResponse } from "next/server";
import { getDb } from "./db";
import { canManageOrg, context, type Ctx } from "./access";

export const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const json = async (req: Request) => ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type Need = "user" | "super" | "orgAdmin";

/** The signed-in person; "super" needs a VALUEFY super-admin, "orgAdmin" an owner / administrator of the current firm. */
export async function api(need: Need = "user"): Promise<{ db: D1Database; c: Ctx } | { res: NextResponse }> {
  const db = await getDb();
  if (!db) return { res: err("Baza de date nu este disponibilă.", 503) };
  const c = await context(db);
  if (!c) return { res: err("Sesiunea a expirat. Autentifică-te din nou.", 401) };
  if (need === "super" && !c.super) return { res: err("Nu ai drepturi pentru această acțiune.", 403) };
  if (need === "orgAdmin" && !(c.org && canManageOrg(c))) return { res: err("Doar administratorii firmei pot face asta.", 403) };
  return { db, c };
}
