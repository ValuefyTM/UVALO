// Server-only: who the signed-in person is, which firm they work in and what that firm's subscription allows.
import { toolSettings } from "./tools";
import { collabAllowed, collabSettings } from "./collab";
import type { CollabMode } from "./collab-shared";
import { modeAllowed, modeSettings } from "./modmode";
import { now } from "./db";
import { cookies } from "next/headers";
import { currentSession, getUser, type Session, type User } from "./auth";

export type Role = "owner" | "admin" | "member";
export const ROLE_LABEL: Record<Role, string> = { owner: "Titular cont", admin: "Administrator", member: "Membru" };

export type Org = {
  id: string; name: string; cui: string | null; city: string | null; status: "active" | "suspended"; plan_id: string; plan_name: string; modules: string;
  seats: number; valid_until: string | null; billing_email: string | null; notes: string | null; created_at: string;
  corporate: number; corp_no: string | null; description: string | null; has_logo: number; office_at: string | null;
};
export type Membership = { org_id: string; org_name: string; role: Role; org_status: string };

/** Modules of the platform; more come later (analize de piață…). */
export const MODULES = [
  { key: "localizare", name: "Localizator cadastral", href: "/localizare", desc: "Număr cadastral, topo, adresă sau locația ta pe teren, pe planurile cadastrale din Timiș." },
  { key: "amplasament", name: "Analiza amplasamentului", href: "/amplasament", desc: "Fișa amplasamentului din planul cadastral și OpenStreetMap, cu text pentru raport generat cu AI." },
  { key: "comparabile", name: "Localizator de comparabile", href: "/comparabile", desc: "Pune subiectul și comparabilele pe hartă, cu distanța până la fiecare. Gata de inserat în raport." },
  { key: "chrome", name: "UVALO pentru Chrome", href: "/chrome", desc: "Capturi complete ale anunțurilor imobiliare, pe pagini A4, și dosarul Word/PDF cu comparabilele." },
  { key: "word", name: "UVALO pentru Word", href: "/word", desc: "Anexa foto și anexa cu documente PDF, direct în raportul Word, dintr-un tab UVALO." },
] as const;

export const ORG_SQL = `SELECT o.id, o.name, o.cui, o.city, o.status, o.plan_id, o.seats, o.valid_until, o.billing_email, o.notes, o.created_by, o.created_at, o.updated_at,
  o.corporate, o.corp_no, o.description, o.logo IS NOT NULL AS has_logo, o.office_at, p.name AS plan_name, p.modules FROM orgs o JOIN plans p ON p.id = o.plan_id`;

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
  /** Modules the person may use now (super-admins: all, even the ones turned off). */
  modules: string[]; block: string | null;
  /** Tools turned off by the administration (Admin → Instrumente). */
  off: string[];
  /** Colaborări: Dezactivat / Test / Activ (in "modules" only for the people allowed in the current mode). */
  collab: CollabMode;
  insp: CollabMode;
  /** "Birou de evaluare" turned on for this person by the administration (super-admins: always). */
  office: boolean;
  /** Offices this person is an associated administrator of (office_links.admin): they see and manage those firms' inspections. */
  linkAdmin: string[];
  /** The new home page (dashboard): by its mode (Admin → Instrumente → Acasă nouă); off = the current home page for everyone. */
  homeNew: boolean;
  /** Set when a super-admin looks at the platform as another person (read-only): who is shown, and who really is signed in. */
  viewAs?: { id: string; name: string; email: string; by: User } | null;
};

/** "Vezi ca utilizatorul": a super-admin's cookie with the id of the person whose platform they look at (read-only; worker.ts refuses writes). */
export const VIEW_COOKIE = "vf_view";

export async function context(db: D1Database): Promise<Ctx | null> {
  const s = await currentSession(db);
  if (!s) return null;
  const c = await contextOf(db, s.user, s.session);
  if (!c.super) return c;
  const v = (await cookies()).get(VIEW_COOKIE)?.value;
  if (!v || v === s.user.id) return c;
  const target = await getUser(db, v);
  if (!target) return c;
  // the platform as that person sees it (their firm, plan, modules; not a super-admin), with the real session kept for signing out
  const vc = await contextOf(db, target, { id: `view:${s.session.id}`, user_id: target.id, org_id: null, created_at: s.session.created_at, last_seen_at: null });
  return { ...vc, session: s.session, viewAs: { id: target.id, name: target.name || target.email, email: target.email, by: s.user } };
}

/** The context of a known person and session (the cookie session, or a pseudo-session `oauth:<token>` for the MCP tokens). */
export async function contextOf(db: D1Database, user: User, session: Session): Promise<Ctx> {
  const { results: orgs } = await db
    .prepare(`SELECT m.org_id, o.name AS org_name, m.role, o.status AS org_status FROM memberships m JOIN orgs o ON o.id = m.org_id
      WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.name`)
    .bind(user.id)
    .all<Membership>();
  const orgId = session.org_id && orgs.some((o) => o.org_id === session.org_id) ? session.org_id : orgs[0]?.org_id ?? null;
  if (orgId !== session.org_id) {
    if (!/^(oauth|view):/.test(session.id)) await db.prepare("UPDATE sessions SET org_id = ? WHERE id = ?").bind(orgId, session.id).run();
    session.org_id = orgId;
  }
  const org = orgId ? await db.prepare(`${ORG_SQL} WHERE o.id = ?`).bind(orgId).first<Org>() : null;
  const role = (orgs.find((o) => o.org_id === orgId)?.role as Role) ?? null;
  const sup = !!user.is_superadmin;
  const block = org ? orgBlock(org) : sup ? null : "Contul tău nu face parte din nicio firmă cu abonament.";
  const { off } = await toolSettings(db);
  const modules = sup ? MODULES.map((m) => m.key) : org && !block ? org.modules.split(",").map((x) => x.trim()).filter((m) => !off.includes(m)) : [];
  // Colaborări is in every plan; who sees it depends on its mode (Admin → Instrumente → Colaborări). Only valuers (with an
  // ANEVAR card): an office's colleagues without one (assistants, inspectors) do not get it.
  const cs = await collabSettings(db);
  const valuer = !!user.anevar_no?.trim();
  if ((sup || valuer) && collabAllowed(cs, { super: sup, userId: user.id, hasAccess: !!org && !block })) modules.push("colaborari");
  // Inspecții: by its mode (Admin → Instrumente → Inspecții): super-admins, the test group, or everyone with access when Activ.
  const ins = await modeSettings(db, "inspectii");
  const insOk = sup || (!off.includes("inspectii") && modeAllowed(ins, { super: sup, userId: user.id, hasAccess: !!org && !block }));
  const ii = modules.indexOf("inspectii");
  if (ii >= 0 && !insOk) modules.splice(ii, 1);
  if (ii < 0 && insOk) modules.push("inspectii");
  const linkAdmin = (await db.prepare("SELECT org_id FROM office_links WHERE user_id = ? AND status = 'active' AND admin = 1").bind(user.id).all<{ org_id: string }>()
    .catch(() => ({ results: [] as { org_id: string }[] }))).results.map((r) => r.org_id);
  const hn = await modeSettings(db, "acasa");
  // super-admins see it only from Test on (with Dezactivat nobody does, so the current home page stays checkable)
  const homeNew = hn.mode !== "off" && modeAllowed(hn, { super: sup, userId: user.id, hasAccess: !!org && !block });
  return { user, session, super: sup, orgs, org, role, modules, block, off, collab: cs.mode, insp: ins.mode, office: sup || !!user.office_allowed, linkAdmin, homeNew };
}

/** "Birou de evaluare" (Firma mea: colleagues, seats): only for the accounts the administration turned it on for (in test). */
export const officeActive = (c: Ctx) => c.office && !!c.user.is_office && !!c.org && canManageOrg(c);

export const canManageOrg = (c: Ctx) => c.super || c.role === "owner" || c.role === "admin";

/** Seats taken in a firm: active members plus pending invitations. */
export async function seatsUsed(db: D1Database, orgId: string) {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.status = 'active' AND u.status NOT IN ('disabled', 'closed')`)
    .bind(orgId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}
