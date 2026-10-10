// Server-only: who the signed-in person is, which firm they work in and what that firm's subscription allows.
import { now } from "./db";
import { currentSession, type Session, type User } from "./auth";

export type Role = "owner" | "admin" | "member";
export const ROLE_LABEL: Record<Role, string> = { owner: "Titular cont", admin: "Administrator", member: "Membru" };

export type Org = {
  id: string; name: string; cui: string | null; city: string | null; status: "active" | "suspended"; plan_id: string; plan_name: string; modules: string;
  seats: number; valid_until: string | null; billing_email: string | null; notes: string | null; created_at: string;
};
export type Membership = { org_id: string; org_name: string; role: Role; org_status: string };

/** Modules of the platform; more come later (analize de piață…). */
export const MODULES = [
  { key: "localizare", name: "Localizator cadastral", href: "/localizare", desc: "Număr cadastral, topo, adresă sau locația ta pe teren, pe planurile cadastrale din Timiș." },
  { key: "amplasament", name: "Analiza amplasamentului", href: "/amplasament", desc: "Fișa amplasamentului din planul cadastral și OpenStreetMap, cu text pentru raport generat cu AI." },
  { key: "comparabile", name: "Localizator de comparabile", href: "/comparabile", desc: "Pune subiectul și comparabilele pe hartă, cu distanța până la fiecare. Gata de inserat în raport." },
] as const;

export const ORG_SQL = `SELECT o.*, p.name AS plan_name, p.modules FROM orgs o JOIN plans p ON p.id = o.plan_id`;

export const today = () => now().slice(0, 10);

/** Why a firm has no access right now, or null when it has. */
export function orgBlock(o: Pick<Org, "status" | "valid_until">) {
  if (o.status !== "active") return "Contul firmei este suspendat.";
  if (o.valid_until && o.valid_until < today()) return `Abonamentul firmei a expirat pe ${o.valid_until.split("-").reverse().join(".")}.`;
  return null;
}

export type Ctx = {
  user: User; session: Session; super: boolean;
  orgs: Membership[]; org: Org | null; role: Role | null;
  /** Modules the person may use now (super-admins: all). */
  modules: string[]; block: string | null;
};

export async function context(db: D1Database): Promise<Ctx | null> {
  const s = await currentSession(db);
  if (!s) return null;
  const { user, session } = s;
  const { results: orgs } = await db
    .prepare(`SELECT m.org_id, o.name AS org_name, m.role, o.status AS org_status FROM memberships m JOIN orgs o ON o.id = m.org_id
      WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.name`)
    .bind(user.id)
    .all<Membership>();
  let orgId = session.org_id && orgs.some((o) => o.org_id === session.org_id) ? session.org_id : orgs[0]?.org_id ?? null;
  if (orgId !== session.org_id) {
    await db.prepare("UPDATE sessions SET org_id = ? WHERE id = ?").bind(orgId, session.id).run();
    session.org_id = orgId;
  }
  const org = orgId ? await db.prepare(`${ORG_SQL} WHERE o.id = ?`).bind(orgId).first<Org>() : null;
  const role = (orgs.find((o) => o.org_id === orgId)?.role as Role) ?? null;
  const sup = !!user.is_superadmin;
  const block = org ? orgBlock(org) : sup ? null : "Contul tău nu face parte din nicio firmă cu abonament.";
  const modules = sup ? MODULES.map((m) => m.key) : org && !block ? org.modules.split(",").map((x) => x.trim()) : [];
  return { user, session, super: sup, orgs, org, role, modules, block };
}

/** "Birou de evaluare" (Firma mea: colleagues, seats) opens together with the subscriptions; until then it shows "În curând". */
export const OFFICE_READY = false;

export const canManageOrg = (c: Ctx) => c.super || c.role === "owner" || c.role === "admin";

/** Seats taken in a firm: active members plus pending invitations. */
export async function seatsUsed(db: D1Database, orgId: string) {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.status = 'active' AND u.status <> 'disabled'`)
    .bind(orgId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}
