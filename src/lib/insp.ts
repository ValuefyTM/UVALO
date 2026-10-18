// Server-only: Inspecții (module `inspectii`). Prepared on the web, done on the phone (UVALO app), seen on the web.
// In test: only super-admins have the module (context() in access.ts); everything written now has test = 1.
import { canManageOrg, type Ctx } from "./access";
import { getFiles, now, uuid } from "./db";
import { randomCode, sha256 } from "./crypto";
import { geocode } from "./gmaps";
import { notifyUser } from "./webpush";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  cleanTemplate, qCount, STATUSES, UVALO_TEMPLATES, type AssignKind, type InspRow, type Status, type Template,
} from "./insp-shared";

const s = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const t = (v: unknown, max = 4000) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
const num = (v: unknown) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : null; };
const J = <T>(v: string | null | undefined, d: T): T => { try { return v ? (JSON.parse(v) as T) : d; } catch { return d; } };

/* ---------- the phone (the module needs the UVALO app connected) ---------- */

export type Device = { id: string; name: string | null; platform: string | null; created_at: string; last_seen_at: string | null };
export async function devices(db: D1Database, userId: string) {
  return (await db.prepare("SELECT id, name, platform, created_at, last_seen_at FROM insp_devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC")
    .bind(userId).all<Device>()).results;
}

/** A 6-digit code (shown on the web, also as a QR to inspectii.uvalo.ro/?pair=…), valid 10 minutes: the phone signs in with it. */
export async function pairCode(db: D1Database, userId: string) {
  const code = randomCode();
  await db.batch([
    db.prepare("DELETE FROM insp_pair_codes WHERE user_id = ? OR expires_at < ?").bind(userId, now()),
    db.prepare("INSERT INTO insp_pair_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(code), userId, new Date(Date.now() + 10 * 60e3).toISOString()),
  ]);
  return code;
}

/** Where the phone app lives (PWA on its own domain, the same worker). */
export const inspUrl = () => (process.env.INSP_URL || "https://inspectii.uvalo.ro").replace(/\/$/, "");

/** QR code / link from the web: the phone opens it and is signed in as the person who showed the code. */
export async function usePairCode(db: D1Database, code: string) {
  const h = await sha256(code.replace(/\D/g, ""));
  const r = await db.prepare("SELECT user_id FROM insp_pair_codes WHERE code_hash = ? AND expires_at > ?").bind(h, now()).first<{ user_id: string }>();
  if (r) await db.prepare("DELETE FROM insp_pair_codes WHERE code_hash = ?").bind(h).run();
  return r?.user_id ?? null;
}

/** The phone app signed in (QR or email code): the device is recorded once per session — this is what turns the module on. */
export async function registerDevice(db: D1Database, userId: string, sessionId: string, ua: string, standalone: boolean) {
  const platform = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other";
  if (platform === "other" && !standalone) return; // a computer's browser is not "the app": only phones (or the installed app) count
  const name = /iPad/i.test(ua) ? "iPad" : /iPhone/i.test(ua) ? "iPhone" : /Android/i.test(ua) ? (ua.match(/;\s*([^;)]+?)\s+Build\//)?.[1] ?? "Android") : "Browser";
  const old = await db.prepare("SELECT id FROM insp_devices WHERE token_hash = ? AND user_id = ?").bind(sessionId, userId).first<{ id: string }>();
  if (old) await db.prepare("UPDATE insp_devices SET last_seen_at = ?, platform = ?, name = ?, revoked_at = NULL WHERE id = ?").bind(now(), platform, `${name}${standalone ? " · aplicație" : ""}`.slice(0, 60), old.id).run();
  else await db.prepare("INSERT INTO insp_devices (id, user_id, name, platform, token_hash, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(uuid(), userId, `${name}${standalone ? " · aplicație" : ""}`.slice(0, 60), platform, sessionId, now()).run();
}

/** This person's place towards a firm's inspections: member of it, linked now (angajat / colaborator), linked before (ended). */
async function relations(db: D1Database, userId: string) {
  const [m, l] = await Promise.all([
    db.prepare("SELECT org_id FROM memberships WHERE user_id = ? AND status = 'active'").bind(userId).all<{ org_id: string }>(),
    db.prepare("SELECT org_id, kind, status FROM office_links WHERE user_id = ? AND status IN ('active', 'ended')").bind(userId).all<{ org_id: string; kind: string; status: string }>(),
  ]);
  const member = new Set(m.results.map((x) => x.org_id));
  const active = new Map(l.results.filter((x) => x.status === "active").map((x) => [x.org_id, x.kind]));
  const ended = new Set(l.results.filter((x) => x.status === "ended").map((x) => x.org_id));
  return { member, active, ended };
}
type Rel = Awaited<ReturnType<typeof relations>>;
/** Done (or created) for a firm whose link with this person ended, and who is not its member: only reading is left. */
const lockedFor = (rel: Rel, _userId: string, r: { org_id?: unknown }) =>
  !!r.org_id && !rel.member.has(String(r.org_id)) && !rel.active.has(String(r.org_id)) && rel.ended.has(String(r.org_id));
/** Phone: where an inspection shows. Inspections from a firm this person is a colaborator of → the Colaborări tab; the rest → Acasă. */
const placeOf = (rel: Rel, r: { org_id?: unknown }) => (r.org_id && rel.active.get(String(r.org_id)) === "colaborator" && !rel.member.has(String(r.org_id)) ? "collab" : "home");

/**
 * The phone's list: what this person has to do (assigned to them), plus what they finished lately. Each row says where it goes
 * (`place`: home / collab), for which firm when it is not theirs (`firm`) and whether it is read-only (`ro`: the link with that firm
 * ended; the unfinished ones of such a firm are left out).
 */
export async function myAssigned(db: D1Database, userId: string) {
  const [{ results }, rel] = await Promise.all([
    db.prepare(`${ROW_SQL} AND i.assignee_id = ?1 AND (i.status IN ('prog', 'plan', 'lucru') OR i.finished_at > ?2)
      ORDER BY CASE WHEN i.status IN ('gata', 'pred') THEN 1 ELSE 0 END, COALESCE(i.scheduled_at, '9999'), i.created_at LIMIT 200`)
      .bind(userId, new Date(Date.now() - 90 * 864e5).toISOString()).all<InspRow>(),
    relations(db, userId),
  ]);
  return results.map((r) => {
    const ro = lockedFor(rel, userId, r);
    const foreign = !!r.org_id && !rel.member.has(String(r.org_id));
    return { ...r, place: placeOf(rel, r), firm: foreign ? r.org_name ?? null : null, ro: ro ? 1 : 0 };
  }).filter((r) => !r.ro || r.status === "gata" || r.status === "pred");
}

/** Offices this person may create inspections for from the phone: linked as angajat, and the office allows it. */
export async function phoneFirms(db: D1Database, userId: string) {
  return (await db.prepare(`SELECT o.id, o.name FROM office_links l JOIN orgs o ON o.id = l.org_id WHERE l.user_id = ? AND l.status = 'active' AND l.kind = 'angajat'
    AND o.staff_create = 1 AND o.status = 'active' ORDER BY o.name`).bind(userId).all<{ id: string; name: string }>()).results;
}

/** Phone app, "Colaborări": inspections this person does for others (prepared by someone else) and those others do for them. */
export async function phoneCollab(db: D1Database, userId: string) {
  const { results } = await db.prepare(`${ROW_SQL} AND ((i.assignee_id = ?1 AND i.created_by <> ?1) OR (i.created_by = ?1 AND i.assignee_id IS NOT NULL AND i.assignee_id <> ?1))
    ORDER BY CASE WHEN i.status IN ('gata', 'pred') THEN 1 ELSE 0 END, COALESCE(i.finished_at, i.scheduled_at, i.created_at) DESC LIMIT 200`)
    .bind(userId).all<InspRow>();
  return results;
}

/** Phone app, "Contul meu": what this person did with the app, and this phone (by its session). */
export async function phoneInfo(db: D1Database, userId: string, sessionId: string) {
  const month = new Date().toISOString().slice(0, 7);
  const [st, ph, dev] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN substr(finished_at, 1, 7) = ? THEN 1 ELSE 0 END) AS month, MAX(finished_at) AS last,
      AVG(CASE WHEN started_at IS NOT NULL THEN (julianday(finished_at) - julianday(started_at)) * 1440 END) AS avg_min
      FROM inspections WHERE assignee_id = ? AND finished_at IS NOT NULL AND deleted_at IS NULL`).bind(month, userId).first<{ total: number; month: number | null; last: string | null; avg_min: number | null }>(),
    db.prepare("SELECT COUNT(*) AS n FROM insp_files f JOIN inspections i ON i.id = f.inspection_id WHERE i.assignee_id = ? AND f.kind = 'photo'").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT name, platform, created_at, last_seen_at FROM insp_devices WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL").bind(sessionId, userId).first<{ name: string; platform: string; created_at: string; last_seen_at: string }>(),
  ]);
  return { stats: { total: st?.total ?? 0, month: st?.month ?? 0, last: st?.last ?? null, avg_min: st?.avg_min ? Math.round(st.avg_min) : null, photos: ph?.n ?? 0 }, device: dev ?? null };
}

/** Phone app, the bell: what other people did on my inspections (assigned to me or mine) in the last 30 days. */
export async function phoneNotifs(db: D1Database, userId: string) {
  const { results } = await db.prepare(`SELECT l.id, l.inspection_id AS insp, l.at, l.text, i.address, COALESCE(NULLIF(u.name, ''), u.email) AS who, l.user_id AS who_id, u.avatar IS NOT NULL AS who_av
    FROM insp_log l JOIN inspections i ON i.id = l.inspection_id LEFT JOIN users u ON u.id = l.user_id
    WHERE (i.assignee_id = ?1 OR i.created_by = ?1) AND i.deleted_at IS NULL AND COALESCE(l.user_id, '') <> ?1 AND l.at > ?2
    ORDER BY l.at DESC LIMIT 40`).bind(userId, new Date(Date.now() - 30 * 864e5).toISOString())
    .all<{ id: number; insp: string; at: string; text: string; address: string; who: string | null; who_id: string | null; who_av: number }>();
  return results;
}

/** "Deconectează telefonul": the phone leaves the list on the web and its session ends. */
export async function disconnectPhone(db: D1Database, userId: string, sessionId: string) {
  await db.batch([
    db.prepare("UPDATE insp_devices SET revoked_at = ? WHERE token_hash = ? AND user_id = ?").bind(now(), sessionId, userId),
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").bind(now(), sessionId),
  ]);
}

/** Test mode only: a stand-in "phone" so the web part can be tried before the app exists. */
export async function testDevice(db: D1Database, userId: string) {
  await db.prepare("INSERT INTO insp_devices (id, user_id, name, platform, last_seen_at) VALUES (?, ?, 'Mod test (fără telefon)', 'test', ?)").bind(uuid(), userId, now()).run();
}
export async function revokeDevice(db: D1Database, userId: string, id: string) {
  await db.prepare("UPDATE insp_devices SET revoked_at = ? WHERE id = ? AND user_id = ?").bind(now(), id, userId).run();
}

/* ---------- templates ---------- */

export type TplRow = { id: string; owner_type: "org" | "user" | "uvalo"; owner_id: string; name: string; prop_type: string | null; draft: Template; published: Template | null;
  version: number; enforced: number; updated_at: string; dirty: boolean };

export async function templates(db: D1Database, c: Ctx): Promise<TplRow[]> {
  const { results } = await db.prepare(`SELECT * FROM insp_templates WHERE deleted_at IS NULL AND ((owner_type = 'user' AND owner_id = ?) OR (owner_type = 'org' AND owner_id = ?))
    ORDER BY owner_type, name`).bind(c.user.id, c.org?.id ?? "-").all<Record<string, unknown>>();
  const own = results.map((r) => {
    const draft = cleanTemplate(J(r.draft as string, {})), published = r.published ? cleanTemplate(J(r.published as string, {})) : null;
    return { id: r.id as string, owner_type: r.owner_type as "org" | "user", owner_id: r.owner_id as string, name: r.name as string, prop_type: (r.prop_type as string) ?? null,
      draft, published, version: r.version as number, enforced: r.enforced as number, updated_at: r.updated_at as string, dirty: JSON.stringify(draft) !== JSON.stringify(published) };
  });
  const uv = UVALO_TEMPLATES.map((u) => ({ id: `uvalo:${u.key}`, owner_type: "uvalo" as const, owner_id: "uvalo", name: u.name, prop_type: u.prop, draft: u.tpl, published: u.tpl,
    version: 1, enforced: 0, updated_at: "", dirty: false }));
  return [...own, ...uv];
}

/** Who may change a template: its owner, or for a firm's template its owner / administrators. */
const canEditTpl = (c: Ctx, r: { owner_type: string; owner_id: string }) =>
  c.super || (r.owner_type === "user" && r.owner_id === c.user.id) || (r.owner_type === "org" && r.owner_id === c.org?.id && (c.role === "owner" || c.role === "admin"));

export async function tplAction(db: D1Database, c: Ctx, b: Record<string, unknown>): Promise<{ ok: true; id?: string } | { error: string }> {
  const action = s(b.action, 30), id = s(b.id, 80);
  if (action === "tpl_duplicate" || action === "tpl_new") {
    const src = action === "tpl_duplicate" ? (await templates(db, c)).find((x) => x.id === id) : null;
    if (action === "tpl_duplicate" && !src) return { error: "Fișa nu există." };
    const forOrg = b.owner === "org" && !!c.org && (c.super || c.role === "owner" || c.role === "admin");
    const nid = uuid(), name = s(b.name, 80) || (src ? (src.owner_type === "uvalo" ? `Fișa mea · ${src.prop_type ?? "imobil"}` : `${src.name} (copie)`) : "Fișă nouă");
    const tpl = src ? src.published ?? src.draft : { groups: [{ id: "g1", name: "Grup nou", qs: [] }] };
    await db.prepare("INSERT INTO insp_templates (id, owner_type, owner_id, name, prop_type, draft, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(nid, forOrg ? "org" : "user", forOrg ? c.org!.id : c.user.id, name, src?.prop_type ?? null, JSON.stringify(tpl), c.user.id).run();
    return { ok: true, id: nid };
  }
  const row = await db.prepare("SELECT id, owner_type, owner_id, draft, version, ext_ref FROM insp_templates WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; owner_type: string; owner_id: string; draft: string; version: number; ext_ref: string | null }>();
  if (!row) return { error: "Fișa nu există sau a fost ștearsă." };
  if (!canEditTpl(c, row)) return { error: "Nu poți modifica această fișă." };
  // kept in sync by the firm's software (integration API): changed there, not here (it can still be duplicated)
  if (row.ext_ref) return { error: "Fișa vine din aplicația firmei (CRM) și se modifică acolo. O poți duplica pentru o variantă proprie." };
  if (action === "tpl_save") {
    const tpl = cleanTemplate(b.tpl);
    if (!qCount(tpl)) return { error: "Fișa trebuie să aibă cel puțin o întrebare." };
    await db.prepare("UPDATE insp_templates SET name = ?, prop_type = ?, draft = ?, enforced = ?, updated_at = ? WHERE id = ?")
      .bind(s(b.name, 80) || "Fișă", s(b.prop_type, 60) || null, JSON.stringify(tpl), row.owner_type === "org" && b.enforced ? 1 : 0, now(), id).run();
    return { ok: true, id };
  }
  if (action === "tpl_publish") {
    await db.prepare("UPDATE insp_templates SET published = draft, version = version + 1, updated_at = ? WHERE id = ?").bind(now(), id).run();
    return { ok: true, id };
  }
  if (action === "tpl_delete") {
    await db.prepare("UPDATE insp_templates SET deleted_at = ? WHERE id = ?").bind(now(), id).run();
    return { ok: true };
  }
  return { error: "Acțiune necunoscută." };
}

/** The templates a person can choose for a new inspection (an enforced firm template first). */
export async function usableTemplates(db: D1Database, c: Ctx) {
  const all = await templates(db, c);
  const ok = all.filter((x) => x.owner_type === "uvalo" || x.version > 0);
  const enforced = ok.filter((x) => x.enforced);
  return enforced.length && !c.super ? enforced : [...enforced, ...ok.filter((x) => !x.enforced)];
}

/* ---------- inspections ---------- */

const ROW_SQL = `SELECT i.id, i.code, i.org_id, og.name AS org_name, i.status, i.address, i.prop_type, i.cad_nr, i.lat, i.lng, i.contact_name, i.scheduled_at, i.duration_min, i.created_by,
  COALESCE(NULLIF(o.name, ''), o.email) AS owner_name, o.avatar IS NOT NULL AS owner_av, i.assignee_id, COALESCE(NULLIF(a.name, ''), a.email) AS assignee_name, a.avatar IS NOT NULL AS assignee_av, i.assignee_kind, i.finished_at, i.test, i.redo_note, i.redo_prev_at, i.redo_keep_sig, i.signed_name, i.signed_at, i.assign_state, i.sheet_no, i.sheet_at, i.sheet_rev,
  (SELECT COUNT(*) FROM insp_files f WHERE f.inspection_id = i.id AND f.kind = 'photo') AS photos
  FROM inspections i JOIN users o ON o.id = i.created_by LEFT JOIN users a ON a.id = i.assignee_id LEFT JOIN orgs og ON og.id = i.org_id WHERE i.deleted_at IS NULL`;

/* ---------- the office's people (birou): operational role, firm-wide view ---------- */

/** Operațional: in an office, a member without an ANEVAR card (assistant, secretariat): sees and enters the firm's inspections, does none. */
export const isOps = (c: Ctx) => !c.super && !c.user.anevar_no?.trim() && !!c.org?.office_at;
/** Sees all the firm's inspections: its operationals and administrators (offices only). */
export const firmView = (c: Ctx) => !!c.org?.office_at && (isOps(c) || canManageOrg(c));
/** The firms whose inspections this person sees all of: their own office (administrator / operational) and the offices that made them
 *  an associated administrator. An associate without it sees only the inspections given to them. */
export const firmOrgs = (c: Ctx) => [...(firmView(c) ? [c.org!.id] : []), ...(c.linkAdmin ?? [])];
/** May prepare / change / share an inspection: who prepared it, the firm's viewers for the firm's inspections, super-admins. */
export const canPrepare = (c: Ctx, r: { created_by?: unknown; org_id?: unknown }) =>
  c.super || r.created_by === c.user.id || (!!r.org_id && firmOrgs(c).includes(String(r.org_id)));

export type Who = "mine" | "forme" | "forothers" | "firm";
/** mine = my work, done by me; forme = my work, done by a colleague; forothers = I do it for a colleague's work; firm = the firm's (firm viewers). */
export async function listInspections(db: D1Database, c: Ctx) {
  const userId = c.user.id, firms = firmOrgs(c);
  const { results } = await db.prepare(`${ROW_SQL} AND (i.created_by = ? OR i.assignee_id = ?${firms.length ? ` OR i.org_id IN (${firms.map(() => "?").join(", ")})` : ""})
    ORDER BY COALESCE(i.scheduled_at, i.created_at) DESC LIMIT 800`).bind(userId, userId, ...firms).all<InspRow>();
  const who = (r: InspRow): Who => (r.created_by === userId ? (r.assignee_id && r.assignee_id !== userId) || r.assignee_kind === "collab" ? "forme" : "mine"
    : r.assignee_id === userId ? "forothers" : "firm");
  return results.map((r) => ({ ...r, who: who(r) }));
}

export type Insp = InspRow & {
  cf_nr: string | null; uat: string | null; county: string | null; area_util: number | null; area_land: number | null; rooms: { n: string; a: number | null }[];
  template_id: string | null; template_name: string | null; template_version: number | null; template: Template; contact_phone: string | null; contact_role: string | null;
  answers: Record<string, string | string[]>; facts?: { label: string; value: string }[]; room_answers: { n: string; a: number | null; floor?: string; walls?: string; state?: string }[];
  findings: { diff?: string; defects?: string; notes?: string }; started_at: string | null; signed_name: string | null; signed_at: string | null; notes: string | null;
  created_at: string; org_id: string | null; files: { id: string; kind: string; name: string | null; room: string | null; taken_at: string | null }[];
  log: { at: string; text: string; name: string | null }[]; cover_file_id: string | null; share_token: string | null; share_at: string | null;
};

export async function getInspection(db: D1Database, c: Ctx, id: string): Promise<Insp | null> {
  const r = await inspRow(db, "i.id = ?", id);
  if (!r || !(canPrepare(c, r) || r.assignee_id === c.user.id)) return null;
  const x = await fullInsp(db, r, id);
  if (c.super) return x;
  const rel = await relations(db, c.user.id);
  return { ...x, ro: lockedFor(rel, c.user.id, r) ? 1 : 0, firm: r.org_id && !rel.member.has(String(r.org_id)) ? ((await db.prepare("SELECT name FROM orgs WHERE id = ?").bind(r.org_id).first<{ name: string }>())?.name ?? null) : null };
}

/** The inspection behind a public share link (/fisa/<token>), without any account. */
export async function sharedInspection(db: D1Database, token: string): Promise<Insp | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const r = await inspRow(db, "i.share_token = ?", token);
  return r ? fullInsp(db, r, r.id as string) : null;
}

function inspRow(db: D1Database, where: string, v: string) {
  return db.prepare(`SELECT i.*, COALESCE(NULLIF(o.name, ''), o.email) AS owner_name, COALESCE(NULLIF(a.name, ''), a.email) AS assignee_name,
    (SELECT COUNT(*) FROM insp_files f WHERE f.inspection_id = i.id AND f.kind = 'photo') AS photos
    FROM inspections i JOIN users o ON o.id = i.created_by LEFT JOIN users a ON a.id = i.assignee_id WHERE ${where} AND i.deleted_at IS NULL`).bind(v).first<Record<string, unknown>>();
}

async function fullInsp(db: D1Database, r: Record<string, unknown>, id: string): Promise<Insp> {
  const files = (await db.prepare("SELECT id, kind, name, room, taken_at FROM insp_files WHERE inspection_id = ? ORDER BY taken_at, created_at").bind(id).all<Insp["files"][number]>()).results;
  const log = (await db.prepare(`SELECT l.at, l.text, COALESCE(NULLIF(u.name, ''), u.email) AS name FROM insp_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.inspection_id = ? ORDER BY l.at`)
    .bind(id).all<Insp["log"][number]>()).results;
  return {
    ...(r as unknown as Insp),
    rooms: J(r.rooms as string, []), template: cleanTemplate(J(r.template as string, {})), answers: J(r.answers as string, {}), facts: J(r.facts as string, []),
    room_answers: J(r.room_answers as string, []), findings: J(r.findings as string, {}), files, log,
  };
}

export async function logIt(db: D1Database, id: string, userId: string | null, text: string) {
  await db.prepare("INSERT INTO insp_log (inspection_id, user_id, text) VALUES (?, ?, ?)").bind(id, userId, text.slice(0, 300)).run();
  // an inspection sent by the firm's software (integration API): its webhook hears every change
  const hook = import("./integration").then((m) => m.postHook(db, id, text)).catch(() => {});
  try { (await getCloudflareContext({ async: true })).ctx.waitUntil(hook); } catch { await hook; }
  // not worth a phone notification (from the firm's app: its documents and updates come with the inspection, which is notified once)
  if (/^(Fotografie adăugat|Fișier șters|Link public|Document adăugat|Modificată din aplicația firmei)|simulare|a început să fie completată/i.test(text)) return;
  // done on the web (not in the phone app): the person's own phone is told too (e.g. sent back to complete, rescheduled)
  let fromWeb = false;
  try {
    const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
    fromWeb = !(process.env.INSP_HOSTS ?? "inspectii.uvalo.ro").split(",").map((h) => h.trim().toLowerCase()).includes(host);
  } catch {}
  const p = notifyLog(db, id, userId, text, fromWeb).catch(() => {});
  try { (await getCloudflareContext({ async: true })).ctx.waitUntil(p); } catch { await p; }
}

/** What someone did on an inspection goes, as a phone notification, to the others involved (who prepared it, who does it).
 *  Title = the kind of event ("Inspecție nouă alocată", "Fișă de inspecție ștearsă"…); body = the property type and address, then the
 *  message for the evaluator when there is one (instructions, what to complete, the reason, the schedule). */
async function notifyLog(db: D1Database, id: string, userId: string | null, text: string, fromWeb = false) {
  const r = await db.prepare(`SELECT i.address, i.prop_type, i.notes, i.assignee_id, i.created_by, i.org_id, COALESCE(NULLIF(u.name, ''), u.email) AS who
    FROM inspections i LEFT JOIN users u ON u.id = ? WHERE i.id = ?`).bind(userId ?? "", id)
    .first<{ address: string; prop_type: string | null; notes: string | null; assignee_id: string | null; created_by: string; org_id: string | null; who: string | null }>();
  if (!r) return;
  // several inspections sent together by the firm's app (the assets of one report): one notification, replaced as they come
  if (/^Creată din aplicația firmei/.test(text) && r.assignee_id && r.org_id) {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { results } = await db.prepare(`SELECT address, prop_type FROM inspections WHERE assignee_id = ? AND org_id = ? AND ext_ref IS NOT NULL AND deleted_at IS NULL
        AND status = 'prog' AND created_at >= ? ORDER BY created_at`).bind(r.assignee_id, r.org_id, since).all<{ address: string; prop_type: string | null }>();
    if (results.length > 1) {
      const where = [...new Set(results.map((x) => [x.prop_type, x.address].filter(Boolean).join(" · ")))];
      await notifyUser(db, r.assignee_id, {
        title: `${results.length} inspecții noi alocate`, body: `${where.slice(0, 3).join("\n")}${where.length > 3 ? `\nși încă ${where.length - 3}` : ""}${r.who ? `\nde la ${r.who}` : ""}`,
        url: "/", tag: `insp-new-${r.assignee_id}`,
      });
      return;
    }
  }
  const nice = (t: string) => t.replace(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/, "$3.$2.$1, $4");
  const what = [r.prop_type, r.address].filter(Boolean).join(" · ");
  const note = (r.notes ?? "").trim();
  const from = r.who ? ` · de la ${r.who}` : "";
  for (const to of new Set([r.assignee_id, r.created_by].filter((x): x is string => !!x && (x !== userId || (fromWeb && x === r.assignee_id))))) {
    const mine = to === r.assignee_id;   // the person who does the inspection
    const fresh = /^Creată/.test(text) && mine;
    let title: string, lines: string[] = [what];
    let m: RegExpMatchArray | null;
    if (/^Creată/.test(text)) { title = mine ? "Inspecție nouă alocată" : "Inspecție creată"; if (note) lines.push(note); lines.push(from.slice(3)); }
    else if (/^Solicitare de inspecție/.test(text)) { title = mine ? "Solicitare de inspecție" : "Solicitare trimisă"; if (mine && note) lines.push(note); lines.push(mine ? from.slice(3) : text); }
    else if (/^Realocată/.test(text)) { title = mine ? "Inspecție nouă alocată" : "Inspecție realocată"; if (mine && note) lines.push(note); lines.push(mine ? from.slice(3) : text); }
    else if ((m = text.match(/^Retrimisă pe telefon pentru completare: ([\s\S]*)/))) { title = "Inspecție întoarsă în lucru"; lines.push(m[1].replace(/ \((semnătura salvată rămâne|se semnează din nou)\)$/, "")); }
    else if ((m = text.match(/^Fișa.* a fost ștearsă(?: \(cu fotografiile\))?(?:: ([\s\S]*))?$/))) { title = "Fișă de inspecție ștearsă"; if (m[1]) lines.push(m[1]); if (r.who) lines.push(`de ${r.who}`); }
    else if ((m = text.match(/^Inspecția a fost ștearsă(?:: ([\s\S]*))?/))) { title = "Inspecție ștearsă"; if (m[1]) lines.push(m[1]); if (r.who) lines.push(`de ${r.who}`); }
    else if ((m = text.match(/^Programată pentru (.*)/))) { title = "Inspecție programată"; lines.push(`Pe ${nice(m[1])}${from}`); }
    else if (/^Modificată/.test(text)) { title = "Inspecție modificată"; if (mine && note) lines.push(note); lines.push(text + from); }
    else if (/^A acceptat/.test(text)) { title = "Solicitare acceptată"; lines.push(`${r.who ?? "Colaboratorul"} a acceptat inspecția`); }
    else if ((m = text.match(/^A refuzat solicitarea de inspecție(?:: ([\s\S]*))?/))) { title = "Solicitare refuzată"; lines.push(`${r.who ?? "Colaboratorul"} a refuzat${m[1] ? `: ${m[1]}` : ""}`); }
    else if (/^Începută pe teren/.test(text)) { title = "Inspecție începută"; lines.push(`${r.who ?? "Inspectorul"} e la fața locului`); }
    else if (/^(Completată|Finalizată)/.test(text)) { title = "Inspecție finalizată"; lines.push(text); }
    else if (/^Marcată ca predată/.test(text)) { title = "Inspecție predată"; lines.push(from.slice(3)); }
    else if ((m = text.match(/^Document adăugat: (.*)/))) { title = "Document adăugat"; lines.push(`${m[1]}${from}`); }
    else { title = "Inspecție actualizată"; lines.push(`${r.who ?? "Cineva"}: ${nice(text)}`); }
    // a new one from the firm's app shares its tag with the grouped notification (the next one replaces it)
    await notifyUser(db, to, { title, body: lines.filter(Boolean).join("\n").slice(0, 400), url: `/?open=${id}`, tag: fresh && /aplicația firmei/.test(text) ? `insp-new-${to}` : `insp-${id}` });
  }
}

export async function nextCode(db: D1Database) {
  const y = new Date().getFullYear();
  const r = await db.prepare("SELECT COUNT(*) AS n FROM inspections WHERE code LIKE ?").bind(`INS-${y}-%`).first<{ n: number }>();
  return `INS-${y}-${String((r?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** The next sheet number of the year (FI-2026-0001): counted over every sheet ever numbered, deleted ones included (never reused). */
async function nextSheetNo(db: D1Database) {
  const y = new Date().getFullYear();
  const r = await db.prepare("SELECT COUNT(*) AS n FROM insp_sheets WHERE no LIKE ?").bind(`FI-${y}-%`).first<{ n: number }>();
  return `FI-${y}-${String((r?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** The sheet gets its number and date when it starts being filled in (the first answer sent from the phone, or the simulation). */
async function numberSheet(db: D1Database, r: Record<string, unknown>, at: string) {
  if (r.sheet_no) return;
  for (let k = 0; k < 3; k++) {
    const no = await nextSheetNo(db);
    try {
      await db.batch([
        db.prepare("INSERT INTO insp_sheets (inspection_id, no, started_at, assignee_id) VALUES (?, ?, ?, ?)").bind(r.id, no, at, r.assignee_id ?? null),
        db.prepare("UPDATE inspections SET sheet_no = ?, sheet_at = ? WHERE id = ? AND sheet_no IS NULL").bind(no, at, r.id),
      ]);
      await logIt(db, String(r.id), null, `Fișa ${no} a început să fie completată`);
      return;
    } catch { /* the same number taken at the same moment: try the next one */ }
  }
}

export type TeamGroup = "membru" | "angajat" | "colaborator";
export type TeamMember = { id: string; name: string; group: TeamGroup; legit: string | null; av: boolean; busy: { id: string; at: string; min: number }[] };

/**
 * Who can do an inspection for the current firm ("Cine o face" → din birou): its members with an ANEVAR card (in an office;
 * elsewhere every colleague, as before) and the valuers linked to the office (angajați, colaboratori). Operationals do none.
 * `busy` = their scheduled, unfinished inspections from yesterday on (any firm; only the time, no details) for the availability.
 */
export async function team(db: D1Database, c: Ctx, orgId?: string | null): Promise<TeamMember[]> {
  // the firm whose people are listed: the current one, or (an associated administrator) the office the inspection belongs to
  const org = orgId && orgId !== c.org?.id ? await db.prepare("SELECT id, office_at FROM orgs WHERE id = ?").bind(orgId).first<{ id: string; office_at: string | null }>() : c.org;
  if (!org) return [];
  const office = !!org.office_at;
  const { results } = await db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.anevar_no AS legit, u.avatar IS NOT NULL AS av, 'membru' AS grp FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ?1 AND m.status = 'active' AND u.status NOT IN ('disabled', 'closed') AND u.id <> ?2 ${office ? "AND COALESCE(u.anevar_no, '') <> ''" : ""}
    UNION ALL SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email), u.anevar_no, u.avatar IS NOT NULL, l.kind FROM office_links l JOIN users u ON u.id = l.user_id
      WHERE l.org_id = ?1 AND l.status = 'active' AND u.status NOT IN ('disabled', 'closed') AND u.id <> ?2 AND ?3 = 1`)
    .bind(org.id, c.user.id, office ? 1 : 0).all<{ id: string; name: string; legit: string | null; av: number; grp: TeamGroup }>();
  const seen = new Set<string>();
  const people = results.filter((r) => !seen.has(r.id) && seen.add(r.id)).sort((a, b) => a.name.localeCompare(b.name, "ro"));
  if (!people.length) return [];
  const from = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const { results: busy } = await db.prepare(`SELECT id, assignee_id, scheduled_at, duration_min FROM inspections WHERE deleted_at IS NULL AND status IN ('plan', 'lucru')
    AND scheduled_at >= ? AND assignee_id IN (${people.map(() => "?").join(", ")}) ORDER BY scheduled_at LIMIT 3000`)
    .bind(from, ...people.map((p) => p.id)).all<{ id: string; assignee_id: string; scheduled_at: string; duration_min: number | null }>();
  return people.map((p) => ({ id: p.id, name: p.name, group: p.grp, legit: p.legit, av: !!p.av,
    busy: busy.filter((b) => b.assignee_id === p.id).map((b) => ({ id: b.id, at: b.scheduled_at, min: b.duration_min ?? 60 })) }));
}

function readInput(b: Record<string, unknown>) {
  const rooms = (Array.isArray(b.rooms) ? b.rooms : []).slice(0, 60).map((x: { n?: unknown; a?: unknown }) => ({ n: s(x?.n, 60), a: num(x?.a) })).filter((x) => x.n);
  const when = s(b.scheduled_at, 16);
  return {
    address: s(b.address, 200), cad_nr: s(b.cad_nr, 40) || null, cf_nr: s(b.cf_nr, 60) || null, uat: s(b.uat, 80) || null, county: s(b.county, 40) || null,
    lat: num(b.lat), lng: num(b.lng), prop_type: s(b.prop_type, 60) || null, area_util: num(b.area_util), area_land: num(b.area_land), rooms,
    contact_name: s(b.contact_name, 120) || null, contact_phone: s(b.contact_phone, 40) || null, contact_role: s(b.contact_role, 60) || null,
    scheduled_at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ? when : null, duration_min: Math.max(15, Math.min(480, Math.round(num(b.duration_min) ?? 60))),
    assignee_kind: (["me", "office", "collab"].includes(String(b.assignee_kind)) ? b.assignee_kind : "me") as AssignKind, assignee_id: s(b.assignee_id, 64) || null,
    template_id: s(b.template_id, 80), notes: t(b.notes, 2000) || null,
  };
}

export async function saveInspection(db: D1Database, c: Ctx, b: Record<string, unknown>, opts: { orgId?: string } = {}): Promise<{ ok: true; id: string } | { error: string }> {
  const v = readInput(b);
  if (v.address.length < 5) return { error: "Scrie adresa bunului." };
  const id = s(b.id, 64);
  const old = id ? await db.prepare("SELECT id, created_by, org_id, status, assignee_id, assign_state FROM inspections WHERE id = ? AND deleted_at IS NULL").bind(id)
    .first<{ id: string; created_by: string; org_id: string | null; status: Status; assignee_id: string | null; assign_state: string | null }>() : null;
  if (id && (!old || !canPrepare(c, old))) return { error: "Inspecția nu există." };
  if (old && !c.super && lockedFor(await relations(db, c.user.id), c.user.id, old)) return { error: "Asocierea cu firma s-a încheiat: inspecția se poate doar citi." };
  if (old && (old.status === "gata" || old.status === "pred")) return { error: "Inspecția e finalizată și nu se mai modifică." };
  // who does it: me, a colleague of the firm, or (Colaborări) nobody yet
  let assignee: string | null = c.user.id;
  if (v.assignee_kind === "me" && isOps(c)) return { error: "Rolul operațional nu face inspecții: alege cine din birou o face." };
  // a colaborator asociat gets a request first (accepts or declines); the office's evaluators and angajații get it directly
  let ask: { name: string } | null = null;
  if (v.assignee_kind === "office") {
    const who = v.assignee_id ? (await team(db, c, old?.org_id)).find((x) => x.id === v.assignee_id) : undefined;
    if (!who) return { error: "Alege cine din birou face inspecția." };
    assignee = v.assignee_id;
    if (who.group === "colaborator") ask = { name: who.name };
  } else if (v.assignee_kind === "collab") assignee = null;
  // the template, as a snapshot of the version used
  const tpl = (await usableTemplates(db, c)).find((x) => x.id === v.template_id);
  if (!tpl) return { error: "Alege fișa de inspecție." };
  const snap = tpl.published ?? tpl.draft;
  if (v.lat == null && v.address) { const g = await geocode(v.address).catch(() => null); if (g?.[0]) { v.lat = g[0].lat; v.lng = g[0].lng; } }
  const status: Status = v.scheduled_at ? "plan" : "prog";
  const cols = [v.address, v.cad_nr, v.cf_nr, v.uat, v.county, v.lat, v.lng, v.prop_type || tpl.prop_type, v.area_util, v.area_land, JSON.stringify(v.rooms),
    tpl.id, tpl.name, tpl.version, JSON.stringify(snap), v.contact_name, v.contact_phone, v.contact_role, v.scheduled_at, v.duration_min, assignee, v.assignee_kind, v.notes, status];
  if (old) {
    await db.prepare(`UPDATE inspections SET address = ?, cad_nr = ?, cf_nr = ?, uat = ?, county = ?, lat = ?, lng = ?, prop_type = ?, area_util = ?, area_land = ?, rooms = ?,
      template_id = ?, template_name = ?, template_version = ?, template = ?, contact_name = ?, contact_phone = ?, contact_role = ?, scheduled_at = ?, duration_min = ?,
      assignee_id = ?, assignee_kind = ?, notes = ?, status = ?, updated_at = ? WHERE id = ?`).bind(...cols, now(), id).run();
    await logIt(db, id, c.user.id, "Modificată pe web");
    // same person as before: the request (or its answer) stays; someone else: a new request, or none
    const same = old.assignee_id === assignee && old.assign_state !== "declined";
    const st = same ? old.assign_state : ask ? "pending" : null;
    await db.prepare("UPDATE inspections SET assign_state = ? WHERE id = ?").bind(st, id).run();
    if (!same && ask) await logIt(db, id, c.user.id, `Solicitare de inspecție trimisă lui ${ask.name} (colaborator)`);
    return { ok: true, id };
  }
  const nid = uuid();
  await db.prepare(`INSERT INTO inspections (address, cad_nr, cf_nr, uat, county, lat, lng, prop_type, area_util, area_land, rooms, template_id, template_name, template_version,
    template, contact_name, contact_phone, contact_role, scheduled_at, duration_min, assignee_id, assignee_kind, notes, status, id, code, created_by, org_id, test)
    VALUES (${Array(29).fill("?").join(", ")})`).bind(...cols, nid, await nextCode(db), c.user.id, opts.orgId ?? c.org?.id ?? null, 1).run();
  if (ask) await db.prepare("UPDATE inspections SET assign_state = 'pending' WHERE id = ?").bind(nid).run();
  await logIt(db, nid, c.user.id, `Creată ${b.from_phone ? "pe telefon" : "pe web"}${b.from_doc ? " din documentele încărcate" : ""}`);
  if (ask) await logIt(db, nid, c.user.id, `Solicitare de inspecție trimisă lui ${ask.name} (colaborator)`);
  if (v.scheduled_at) await logIt(db, nid, c.user.id, `Programată pentru ${v.scheduled_at.replace("T", " ")}`);
  return { ok: true, id: nid };
}

export async function inspAction(db: D1Database, c: Ctx, b: Record<string, unknown>): Promise<{ ok: true; id?: string; token?: string } | { error: string }> {
  const action = s(b.action, 30), id = s(b.id, 64);
  const r = await db.prepare("SELECT * FROM inspections WHERE id = ? AND deleted_at IS NULL").bind(id).first<Record<string, unknown>>();
  if (!r || !(canPrepare(c, r) || (action !== "delete" && r.assignee_id === c.user.id))) return { error: "Inspecția nu există." };
  if (!c.super && lockedFor(await relations(db, c.user.id), c.user.id, r)) return { error: "Asocierea cu firma s-a încheiat: inspecția se poate doar citi." };
  if (action === "delete") {
    // logged first: whoever does it (and who prepared it) is told before it leaves their lists
    await logIt(db, id, c.user.id, "Inspecția a fost ștearsă");
    await db.prepare("UPDATE inspections SET deleted_at = ? WHERE id = ?").bind(now(), id).run();
    return { ok: true };
  }
  // the sheet is a record of the property and can be deleted: answers, rooms, findings, signature (and, if asked, the photos) go;
  // the property, contact, documents and history stay. A copy of the deleted sheet is kept in insp_sheets. Optionally given to someone else.
  if (action === "sheet_delete") {
    if (!canPrepare(c, r)) return { error: "Doar cine a pregătit inspecția poate șterge fișa." };
    const ans = J<Record<string, unknown>>(r.answers as string, {}), photos = b.photos === true;
    if (!r.sheet_no && !Object.keys(ans).length && !r.started_at && !r.finished_at) return { error: "Fișa nu a fost începută: nu ai ce șterge." };
    const ts = now(), reason = t(b.reason, 500) || null;
    const snap = JSON.stringify({ status: r.status, answers: ans, room_answers: J(r.room_answers as string, []), findings: J(r.findings as string, {}),
      started_at: r.started_at, finished_at: r.finished_at, signed_name: r.signed_name, signed_at: r.signed_at, redo_note: r.redo_note }).slice(0, 400000);
    const files = photos ? (await db.prepare("SELECT id, r2_key FROM insp_files WHERE inspection_id = ? AND kind IN ('photo', 'signature')").bind(id).all<{ id: string; r2_key: string }>()).results
      : (await db.prepare("SELECT id, r2_key FROM insp_files WHERE inspection_id = ? AND kind = 'signature'").bind(id).all<{ id: string; r2_key: string }>()).results;
    await db.batch([
      r.sheet_no ? db.prepare("UPDATE insp_sheets SET deleted_at = ?, deleted_by = ?, reason = ?, snapshot = ? WHERE no = ?").bind(ts, c.user.id, reason, snap, r.sheet_no)
        : db.prepare("INSERT INTO insp_sheets (inspection_id, no, started_at, assignee_id, deleted_at, deleted_by, reason, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, `FARA-NR-${uuid().slice(0, 8)}`, String(r.started_at ?? ts), r.assignee_id ?? null, ts, c.user.id, reason, snap),
      db.prepare(`UPDATE inspections SET answers = NULL, room_answers = NULL, findings = NULL, started_at = NULL, finished_at = NULL, signed_name = NULL, signed_at = NULL,
        redo_note = NULL, redo_at = NULL, redo_prev_at = NULL, redo_keep_sig = 0, sheet_no = NULL, sheet_at = NULL, sheet_rev = sheet_rev + 1,
        cover_file_id = CASE WHEN ? THEN NULL ELSE cover_file_id END, status = CASE WHEN scheduled_at IS NOT NULL THEN 'plan' ELSE 'prog' END, updated_at = ? WHERE id = ?`)
        .bind(photos ? 1 : 0, ts, id),
      ...(files.length ? [db.prepare(`DELETE FROM insp_files WHERE id IN (${files.map(() => "?").join(", ")})`).bind(...files.map((f) => f.id))] : []),
    ]);
    const bucket = await getFiles();
    if (bucket) for (const f of files) await bucket.delete(f.r2_key).catch(() => {});
    await logIt(db, id, c.user.id, `Fișa${r.sheet_no ? ` ${r.sheet_no}` : ""} a fost ștearsă${photos ? " (cu fotografiile)" : ""}${reason ? `: ${reason}` : ""}`);
    // given again: to the same person (nothing else to do), to me, or to someone from the office
    if (b.assignee_kind === "me" || b.assignee_kind === "office") return inspAction(db, c, { ...b, action: "reassign", id, again: true });
    return { ok: true, id };
  }
  // another inspector, while the inspection is not done: the answers, photos and documents stay with it
  if (action === "reassign") {
    if (!canPrepare(c, r)) return { error: "Doar cine a pregătit inspecția o poate realoca." };
    if (r.status === "gata" || r.status === "pred") return { error: "Inspecția e finalizată și nu se mai realocă." };
    let to = c.user.id, name = c.user.name?.trim() || c.user.email, ask = false;
    const kind = b.assignee_kind === "me" ? "me" : "office";
    if (kind === "me") { if (isOps(c)) return { error: "Rolul operațional nu face inspecții." }; }
    else {
      const who = (await team(db, c, r.org_id ? String(r.org_id) : null)).find((x) => x.id === s(b.assignee_id, 64));
      if (!who) return { error: "Alege cine din birou face inspecția." };
      to = who.id; name = who.name; ask = who.group === "colaborator";
    }
    if (to === r.assignee_id && r.assign_state !== "declined") return b.again ? { ok: true, id } : { error: `Inspecția e deja la ${name}.` };
    const prev = r.assignee_id ? String(r.assignee_id) : null;
    await db.prepare("UPDATE inspections SET assignee_id = ?, assignee_kind = ?, assign_state = ?, updated_at = ? WHERE id = ?")
      .bind(to, kind, ask ? "pending" : null, now(), id).run();
    await logIt(db, id, c.user.id, ask ? `Solicitare de inspecție trimisă lui ${name} (colaborator)` : `Realocată lui ${name}`);
    // the one who had it: told it is no longer theirs (it leaves their phone at the next refresh)
    if (prev && prev !== to && prev !== c.user.id) {
      const p = notifyUser(db, prev, { title: "Inspecție realocată", body: `${[r.prop_type, r.address].filter(Boolean).join(" · ")}\nA fost dată altcuiva`, url: "/", tag: `insp-${id}` }).catch(() => {});
      try { (await getCloudflareContext({ async: true })).ctx.waitUntil(p); } catch { await p; }
    }
    return { ok: true, id };
  }
  // a request to a colaborator: they accept it (then it is theirs to do) or decline it (back to the office, without anyone)
  if (action === "accept" || action === "decline") {
    if (r.assignee_id !== c.user.id || r.assign_state !== "pending") return { error: "Solicitarea nu mai este în așteptare." };
    if (action === "accept") {
      await db.prepare("UPDATE inspections SET assign_state = NULL, updated_at = ? WHERE id = ?").bind(now(), id).run();
      await logIt(db, id, c.user.id, "A acceptat solicitarea de inspecție");
    } else {
      await db.prepare("UPDATE inspections SET assign_state = 'declined', assignee_id = NULL, updated_at = ? WHERE id = ?").bind(now(), id).run();
      await logIt(db, id, c.user.id, `A refuzat solicitarea de inspecție${s(b.note, 200) ? `: ${s(b.note, 200)}` : ""}`);
    }
    return { ok: true, id };
  }
  if (r.assign_state === "pending" && r.assignee_id === c.user.id && !canPrepare(c, r) && ["schedule", "progress", "finish"].includes(action))
    return { error: "Acceptă întâi solicitarea de inspecție." };
  if (action === "schedule") {
    const when = s(b.scheduled_at, 16);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return { error: "Alege data și ora." };
    if (r.status !== "prog" && r.status !== "plan") return { error: "Inspecția a început deja." };
    const dur = num(b.duration_min);
    await db.prepare("UPDATE inspections SET scheduled_at = ?, duration_min = COALESCE(?, duration_min), status = 'plan', updated_at = ? WHERE id = ?")
      .bind(when, dur ? Math.max(15, Math.min(480, Math.round(dur))) : null, now(), id).run();
    await logIt(db, id, c.user.id, `Programată pentru ${when.replace("T", " ")}`);
    return { ok: true, id };
  }
  if (action === "reopen") {
    // back to the phone, to complete details: the answers, photos and documents stay; the signature is taken again
    if (!canPrepare(c, r)) return { error: "Doar cine a pregătit inspecția o poate retrimite." };
    if (r.status !== "gata" && r.status !== "pred") return { error: "Inspecția nu este finalizată." };
    if (!r.assignee_id) return { error: "Inspecția nu are cine să o facă." };
    const note = t(b.note, 1000);
    if (!note) return { error: "Scrie ce trebuie completat." };
    // keep_sig: the signature already given stays (the person present does not sign again); otherwise it is taken again
    const keep = b.keep_sig !== false && !!r.signed_at;
    await db.prepare(`UPDATE inspections SET status = 'lucru', redo_prev_at = COALESCE(finished_at, redo_prev_at), finished_at = NULL,
      signed_at = CASE WHEN ? THEN signed_at ELSE NULL END, redo_keep_sig = ?, redo_note = ?, redo_at = ?, updated_at = ? WHERE id = ?`)
      .bind(keep ? 1 : 0, keep ? 1 : 0, note, now(), now(), id).run();
    await logIt(db, id, c.user.id, `Retrimisă pe telefon pentru completare: ${note}${keep ? " (semnătura salvată rămâne)" : " (se semnează din nou)"}`);
    return { ok: true, id };
  }
  if (action === "cover") {
    // the sheet's profile photo: one of the inspection's photos (empty = the first exterior one is used)
    const fid = s(b.file_id, 64);
    if (fid && !(await db.prepare("SELECT 1 FROM insp_files WHERE id = ? AND inspection_id = ? AND kind = 'photo'").bind(fid, id).first())) return { error: "Fotografia nu există." };
    await db.prepare("UPDATE inspections SET cover_file_id = ?, updated_at = ? WHERE id = ?").bind(fid || null, now(), id).run();
    return { ok: true, id };
  }
  if (action === "share") {
    // public link to the sheet as a web page (no account): on = a random token (kept when already shared), off = the link stops working
    if (!canPrepare(c, r)) return { error: "Doar cine a pregătit inspecția o poate distribui." };
    if (b.on === false) {
      await db.prepare("UPDATE inspections SET share_token = NULL, share_at = NULL WHERE id = ?").bind(id).run();
      await logIt(db, id, c.user.id, "Linkul public a fost oprit");
      return { ok: true, id };
    }
    if (r.share_token) return { ok: true, id, token: r.share_token as string };
    const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await db.prepare("UPDATE inspections SET share_token = ?, share_at = ? WHERE id = ?").bind(token, now(), id).run();
    await logIt(db, id, c.user.id, "Link public creat");
    return { ok: true, id, token };
  }
  if (action === "status") {
    const st = s(b.status, 10) as Status;
    if (!STATUSES.includes(st)) return { error: "Stare necunoscută." };
    await db.prepare("UPDATE inspections SET status = ?, updated_at = ? WHERE id = ?").bind(st, now(), id).run();
    await logIt(db, id, c.user.id, st === "pred" ? "Marcată ca predată" : `Stare: ${st}`);
    return { ok: true, id };
  }
  if (action === "progress" || action === "finish") {
    // from the phone: the answers so far (in progress) or the finished sheet, signed by the person present
    if (r.status === "gata" || r.status === "pred") return { error: "Inspecția a fost deja trimisă." };
    // a phone still holding the sheet that was deleted on the web: refused (the phone then drops its draft)
    if (b.rev != null && Number(b.rev) !== Number(r.sheet_rev ?? 0)) return { error: "Fișa a fost ștearsă de pe web; inspecția începe cu o fișă nouă." };
    const answers = typeof b.answers === "object" && b.answers ? b.answers : {};
    const rooms = Array.isArray(b.room_answers) ? b.room_answers.slice(0, 80) : [];
    const f = (b.findings ?? {}) as Record<string, unknown>;
    const findings = { diff: t(f.diff, 2000), defects: t(f.defects, 2000), notes: t(f.notes, 2000) };
    const ts = now(), fin = action === "finish";
    // sent back with the saved signature kept: finishing needs no new signature
    const keepSig = !!r.redo_note && !!r.redo_keep_sig && !!r.signed_at;
    const signer = s(b.signed_name, 120) || (keepSig ? String(r.signed_name ?? "") : "");
    if (fin && !signer) return { error: "Scrie numele persoanei prezente." };
    await db.prepare(`UPDATE inspections SET answers = ?, room_answers = ?, findings = ?, status = ?, started_at = COALESCE(started_at, ?), finished_at = ?,
      signed_name = COALESCE(?, signed_name), signed_at = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(answers).slice(0, 200000), JSON.stringify(rooms).slice(0, 100000), JSON.stringify(findings), fin ? "gata" : "lucru", s(b.started_at, 30) || ts,
        // the inspection's date stays the first finalization (a sheet sent back and completed keeps it)
        fin ? (r.redo_prev_at ? String(r.redo_prev_at) : ts) : null, fin ? signer : null, fin ? (keepSig && !b.new_sig ? r.signed_at : ts) : (r.signed_at ?? null), ts, id).run();
    await numberSheet(db, r, s(b.started_at, 30) || ts);
    if (r.status !== "lucru" && !fin) await logIt(db, id, c.user.id, `Începută pe teren${b.near ? ` (la ${Math.round(Number(b.near))} m de adresă)` : ""}`);
    if (fin) {
      if (r.redo_note) await db.prepare("UPDATE inspections SET redo_note = NULL, redo_keep_sig = 0 WHERE id = ?").bind(id).run();
      await logIt(db, id, c.user.id, r.redo_note ? (keepSig && !b.new_sig ? `Completată pe telefon (semnătura lui ${signer} păstrată)` : `Completată și semnată din nou pe telefon de ${signer}`)
        : `Finalizată și semnată pe telefon de ${signer}`);
    }
    return { ok: true, id };
  }
  if (action === "simulate") {
    // Test mode: fills the template as the phone would, so the web pages can be tried before the app exists.
    if (!c.super) return { error: "Doar în modul de test." };
    const tpl = cleanTemplate(J(r.template as string, {}));
    const answers: Record<string, string | string[]> = {};
    for (const g of tpl.groups) for (const q of g.qs) {
      if (q.id === "completion_pct") continue;
      if (q.kind === "comp") {
        const o = q.def ?? q.options?.[0] ?? "";
        answers[q.id] = o;
        for (const sq of q.sub?.[o] ?? []) answers[`${q.id}.${sq.id}`] = sq.kind === "number" ? "12" : sq.kind === "many" ? (sq.options ?? []).slice(0, 1) : sq.kind === "one" ? sq.options?.[0] ?? "" : "[completat pe teren]";
        continue;
      }
      answers[q.id] = q.kind === "many" ? (q.options ?? []).slice(0, Math.min(3, (q.options ?? []).length)) : q.kind === "number" ? (q.unit === "m" ? "16,2" : /an/i.test(q.t) ? "2004" : "1")
        : q.kind === "date" ? now().slice(0, 10) : q.kind === "text" ? (/prezent/i.test(q.t) ? String(r.contact_name ?? "Persoana de contact") : "[completat pe teren]") : q.def ?? q.options?.[0] ?? "";
    }
    const rooms = J<{ n: string; a: number | null }[]>(r.rooms as string, []);
    const ra = (rooms.length ? rooms : [{ n: "Hol", a: 8.2 }, { n: "Living", a: 26.4 }, { n: "Bucătărie", a: 11.4 }, { n: "Dormitor", a: 15.8 }, { n: "Baie", a: 6.9 }])
      .map((x, i) => ({ ...x, floor: ["Gresie", "Parchet", "Gresie", "Parchet", "Gresie"][i % 5], walls: ["Vopsea lavabilă", "Vopsea lavabilă", "Faianță", "Vopsea lavabilă", "Faianță"][i % 5],
        ceiling: "Vopsea lavabilă", state: "Bună" }));
    const start = new Date(Date.now() - 58 * 60e3).toISOString(), end = now();
    await db.prepare(`UPDATE inspections SET answers = ?, room_answers = ?, findings = ?, status = 'gata', started_at = ?, finished_at = ?, signed_name = ?, signed_at = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(answers), JSON.stringify(ra), JSON.stringify({ diff: "[diferențe față de acte]", defects: "[defecte vizibile]", notes: "[observații]" }), start, end,
        r.contact_name ?? null, end, end, id).run();
    await numberSheet(db, r, start);
    await logIt(db, id, c.user.id, "Începută pe teren (simulare în modul de test)");
    await logIt(db, id, c.user.id, "Finalizată și semnată (simulare în modul de test)");
    return { ok: true, id };
  }
  return { error: "Acțiune necunoscută." };
}

/* ---------- files (R2): documents and photos of an inspection ---------- */

export const FILE_KINDS = ["cf", "releveu", "doc", "photo", "signature"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
const MIME: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const FILE_MAX = 15 * 1024 * 1024;

/** Who may see / add files: the owner of the work, the one who does it, super-admins. */
async function canTouch(db: D1Database, c: Ctx, inspId: string, write = true) {
  const r = await db.prepare("SELECT created_by, org_id, assignee_id FROM inspections WHERE id = ? AND deleted_at IS NULL").bind(inspId).first<{ created_by: string; org_id: string | null; assignee_id: string | null }>();
  if (!r) return false;
  if (c.super) return true;
  // after the link with the firm ended, only reading (also for what the person created for that firm)
  if (write && lockedFor(await relations(db, c.user.id), c.user.id, r)) return false;
  return canPrepare(c, r) || r.assignee_id === c.user.id;
}

export async function addFile(db: D1Database, bucket: R2Bucket, c: Ctx, inspId: string, f: File, meta: { kind: string; name?: string; room?: string; taken_at?: string; lat?: unknown; lng?: unknown }): Promise<{ error: string } | { ok: true; id: string }> {
  if (!(await canTouch(db, c, inspId))) return { error: "Inspecția nu există." };
  const ext = MIME[f.type];
  if (!ext) return { error: "Fișierul trebuie să fie PDF sau imagine (JPG, PNG, WEBP)." };
  if (f.size > FILE_MAX) return { error: "Fișierul are peste 15 MB." };
  const kind = (FILE_KINDS as readonly string[]).includes(meta.kind) ? meta.kind : "doc";
  const id = uuid(), key = `insp/${inspId}/${id}.${ext}`;
  // R2 needs the length up front (a form file's stream has none): read whole, it is at most 15 MB
  await bucket.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
  await db.prepare("INSERT INTO insp_files (id, inspection_id, kind, name, room, r2_key, taken_at, lat, lng, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, inspId, kind, s(meta.name ?? f.name, 120) || null, s(meta.room, 60) || null, key, s(meta.taken_at, 30) || null, num(meta.lat), num(meta.lng),
      JSON.stringify({ type: f.type, size: f.size, by: c.user.id })).run();
  await logIt(db, inspId, c.user.id, `${kind === "photo" ? "Fotografie" : "Document"} adăugat: ${s(meta.name ?? f.name, 80) || kind}`);
  return { ok: true, id };
}

export async function fileFor(db: D1Database, c: Ctx, id: string) {
  const f = await db.prepare("SELECT id, inspection_id, name, r2_key, meta FROM insp_files WHERE id = ?").bind(id).first<{ id: string; inspection_id: string; name: string | null; r2_key: string; meta: string | null }>();
  return f && (await canTouch(db, c, f.inspection_id, false)) ? f : null;
}

/** Moves a photo to another category (room) of the inspection. */
export async function moveFile(db: D1Database, c: Ctx, id: string, room: string): Promise<{ error: string } | { ok: true; id: string }> {
  const f = await fileFor(db, c, id);
  if (!f || !(await canTouch(db, c, f.inspection_id))) return { error: "Fișierul nu există." };
  const r = s(room, 120);
  if (!r) return { error: "Alege categoria." };
  await db.prepare("UPDATE insp_files SET room = ? WHERE id = ? AND kind = 'photo'").bind(r, id).run();
  return { ok: true, id: f.inspection_id };
}

export async function removeFile(db: D1Database, bucket: R2Bucket | null, c: Ctx, id: string): Promise<{ error: string } | { ok: true; id: string }> {
  const f = await fileFor(db, c, id);
  if (!f || !(await canTouch(db, c, f.inspection_id))) return { error: "Fișierul nu există." };
  if (bucket) await bucket.delete(f.r2_key).catch(() => {});
  await db.prepare("DELETE FROM insp_files WHERE id = ?").bind(id).run();
  await logIt(db, f.inspection_id, c.user.id, `Fișier șters: ${f.name ?? ""}`);
  return { ok: true, id: f.inspection_id };
}
