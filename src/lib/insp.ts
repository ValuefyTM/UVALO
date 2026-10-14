// Server-only: Inspecții (module `inspectii`). Prepared on the web, done on the phone (UVALO app), seen on the web.
// In test: only super-admins have the module (context() in access.ts); everything written now has test = 1.
import type { Ctx } from "./access";
import { now, uuid } from "./db";
import { randomCode, sha256 } from "./crypto";
import { geocode } from "./gmaps";
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

/** A 6-digit code the app asks for, valid 10 minutes (the phone app is not built yet: it will exchange it for its token). */
export async function pairCode(db: D1Database, userId: string) {
  const code = randomCode();
  await db.batch([
    db.prepare("DELETE FROM insp_pair_codes WHERE user_id = ? OR expires_at < ?").bind(userId, now()),
    db.prepare("INSERT INTO insp_pair_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(code), userId, new Date(Date.now() + 10 * 60e3).toISOString()),
  ]);
  return code;
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
    const nid = uuid(), name = s(b.name, 80) || (src ? src.name.replace(/^UVALO · /, "") + " (copie)" : "Fișă nouă");
    const tpl = src ? src.published ?? src.draft : { groups: [{ id: "g1", name: "Grup nou", qs: [] }] };
    await db.prepare("INSERT INTO insp_templates (id, owner_type, owner_id, name, prop_type, draft, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(nid, forOrg ? "org" : "user", forOrg ? c.org!.id : c.user.id, name, src?.prop_type ?? null, JSON.stringify(tpl), c.user.id).run();
    return { ok: true, id: nid };
  }
  const row = await db.prepare("SELECT id, owner_type, owner_id, draft, version FROM insp_templates WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; owner_type: string; owner_id: string; draft: string; version: number }>();
  if (!row) return { error: "Fișa nu există sau a fost ștearsă." };
  if (!canEditTpl(c, row)) return { error: "Nu poți modifica această fișă." };
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

const ROW_SQL = `SELECT i.id, i.code, i.status, i.address, i.prop_type, i.cad_nr, i.lat, i.lng, i.contact_name, i.scheduled_at, i.duration_min, i.created_by,
  COALESCE(NULLIF(o.name, ''), o.email) AS owner_name, i.assignee_id, COALESCE(NULLIF(a.name, ''), a.email) AS assignee_name, i.assignee_kind, i.finished_at, i.test,
  (SELECT COUNT(*) FROM insp_files f WHERE f.inspection_id = i.id AND f.kind = 'photo') AS photos
  FROM inspections i JOIN users o ON o.id = i.created_by LEFT JOIN users a ON a.id = i.assignee_id WHERE i.deleted_at IS NULL`;

export type Who = "mine" | "forme" | "forothers";
/** mine = my work, done by me; forme = my work, done by a colleague; forothers = I do it for a colleague's work. */
export async function listInspections(db: D1Database, userId: string) {
  const { results } = await db.prepare(`${ROW_SQL} AND (i.created_by = ?1 OR i.assignee_id = ?1) ORDER BY COALESCE(i.scheduled_at, i.created_at) DESC LIMIT 500`).bind(userId).all<InspRow>();
  const who = (r: InspRow): Who => (r.created_by === userId ? (r.assignee_id && r.assignee_id !== userId) || r.assignee_kind === "collab" ? "forme" : "mine" : "forothers");
  return results.map((r) => ({ ...r, who: who(r) }));
}

export type Insp = InspRow & {
  cf_nr: string | null; uat: string | null; county: string | null; area_util: number | null; area_land: number | null; rooms: { n: string; a: number | null }[];
  template_id: string | null; template_name: string | null; template_version: number | null; template: Template; contact_phone: string | null; contact_role: string | null;
  answers: Record<string, string | string[]>; room_answers: { n: string; a: number | null; floor?: string; walls?: string; state?: string }[];
  findings: { diff?: string; defects?: string; notes?: string }; started_at: string | null; signed_name: string | null; signed_at: string | null; notes: string | null;
  created_at: string; org_id: string | null; files: { id: string; kind: string; name: string | null; room: string | null; taken_at: string | null }[];
  log: { at: string; text: string; name: string | null }[];
};

export async function getInspection(db: D1Database, c: Ctx, id: string): Promise<Insp | null> {
  const r = await db.prepare(`SELECT i.*, COALESCE(NULLIF(o.name, ''), o.email) AS owner_name, COALESCE(NULLIF(a.name, ''), a.email) AS assignee_name,
    (SELECT COUNT(*) FROM insp_files f WHERE f.inspection_id = i.id AND f.kind = 'photo') AS photos
    FROM inspections i JOIN users o ON o.id = i.created_by LEFT JOIN users a ON a.id = i.assignee_id WHERE i.id = ? AND i.deleted_at IS NULL`).bind(id).first<Record<string, unknown>>();
  if (!r || !(c.super || r.created_by === c.user.id || r.assignee_id === c.user.id)) return null;
  const files = (await db.prepare("SELECT id, kind, name, room, taken_at FROM insp_files WHERE inspection_id = ? ORDER BY taken_at, created_at").bind(id).all<Insp["files"][number]>()).results;
  const log = (await db.prepare(`SELECT l.at, l.text, COALESCE(NULLIF(u.name, ''), u.email) AS name FROM insp_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.inspection_id = ? ORDER BY l.at`)
    .bind(id).all<Insp["log"][number]>()).results;
  return {
    ...(r as unknown as Insp),
    rooms: J(r.rooms as string, []), template: cleanTemplate(J(r.template as string, {})), answers: J(r.answers as string, {}),
    room_answers: J(r.room_answers as string, []), findings: J(r.findings as string, {}), files, log,
  };
}

async function logIt(db: D1Database, id: string, userId: string | null, text: string) {
  await db.prepare("INSERT INTO insp_log (inspection_id, user_id, text) VALUES (?, ?, ?)").bind(id, userId, text.slice(0, 300)).run();
}

async function nextCode(db: D1Database) {
  const y = new Date().getFullYear();
  const r = await db.prepare("SELECT COUNT(*) AS n FROM inspections WHERE code LIKE ?").bind(`INS-${y}-%`).first<{ n: number }>();
  return `INS-${y}-${String((r?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** Colleagues of the current firm who can do an inspection (office). */
export async function colleagues(db: D1Database, c: Ctx) {
  if (!c.org) return [];
  return (await db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ? AND m.status = 'active' AND u.id != ? ORDER BY name`).bind(c.org.id, c.user.id).all<{ id: string; name: string }>()).results;
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

export async function saveInspection(db: D1Database, c: Ctx, b: Record<string, unknown>): Promise<{ ok: true; id: string } | { error: string }> {
  const v = readInput(b);
  if (v.address.length < 5) return { error: "Scrie adresa bunului." };
  const id = s(b.id, 64);
  const old = id ? await db.prepare("SELECT id, created_by, status FROM inspections WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; created_by: string; status: Status }>() : null;
  if (id && (!old || (old.created_by !== c.user.id && !c.super))) return { error: "Inspecția nu există." };
  if (old && (old.status === "gata" || old.status === "pred")) return { error: "Inspecția e finalizată și nu se mai modifică." };
  // who does it: me, a colleague of the firm, or (Colaborări) nobody yet
  let assignee: string | null = c.user.id;
  if (v.assignee_kind === "office") {
    if (!v.assignee_id || !(await colleagues(db, c)).some((x) => x.id === v.assignee_id)) return { error: "Alege colegul din birou." };
    assignee = v.assignee_id;
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
    return { ok: true, id };
  }
  const nid = uuid();
  await db.prepare(`INSERT INTO inspections (address, cad_nr, cf_nr, uat, county, lat, lng, prop_type, area_util, area_land, rooms, template_id, template_name, template_version,
    template, contact_name, contact_phone, contact_role, scheduled_at, duration_min, assignee_id, assignee_kind, notes, status, id, code, created_by, org_id, test)
    VALUES (${Array(29).fill("?").join(", ")})`).bind(...cols, nid, await nextCode(db), c.user.id, c.org?.id ?? null, 1).run();
  await logIt(db, nid, c.user.id, `Creată pe web${b.from_doc ? " din documentele încărcate" : ""}`);
  if (v.scheduled_at) await logIt(db, nid, c.user.id, `Programată pentru ${v.scheduled_at.replace("T", " ")}`);
  return { ok: true, id: nid };
}

export async function inspAction(db: D1Database, c: Ctx, b: Record<string, unknown>): Promise<{ ok: true; id?: string } | { error: string }> {
  const action = s(b.action, 30), id = s(b.id, 64);
  const r = await db.prepare("SELECT * FROM inspections WHERE id = ? AND deleted_at IS NULL").bind(id).first<Record<string, unknown>>();
  if (!r || !(c.super || r.created_by === c.user.id || (action !== "delete" && r.assignee_id === c.user.id))) return { error: "Inspecția nu există." };
  if (action === "delete") {
    await db.prepare("UPDATE inspections SET deleted_at = ? WHERE id = ?").bind(now(), id).run();
    return { ok: true };
  }
  if (action === "schedule") {
    const when = s(b.scheduled_at, 16);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return { error: "Alege data și ora." };
    if (r.status !== "prog" && r.status !== "plan") return { error: "Inspecția a început deja." };
    await db.prepare("UPDATE inspections SET scheduled_at = ?, status = 'plan', updated_at = ? WHERE id = ?").bind(when, now(), id).run();
    await logIt(db, id, c.user.id, `Programată pentru ${when.replace("T", " ")}`);
    return { ok: true, id };
  }
  if (action === "status") {
    const st = s(b.status, 10) as Status;
    if (!STATUSES.includes(st)) return { error: "Stare necunoscută." };
    await db.prepare("UPDATE inspections SET status = ?, updated_at = ? WHERE id = ?").bind(st, now(), id).run();
    await logIt(db, id, c.user.id, st === "pred" ? "Marcată ca predată" : `Stare: ${st}`);
    return { ok: true, id };
  }
  if (action === "simulate") {
    // Test mode: fills the template as the phone would, so the web pages can be tried before the app exists.
    if (!c.super) return { error: "Doar în modul de test." };
    const tpl = cleanTemplate(J(r.template as string, {}));
    const answers: Record<string, string | string[]> = {};
    for (const g of tpl.groups) for (const q of g.qs) {
      answers[q.id] = q.kind === "many" ? (q.options ?? []).slice(0, Math.min(3, (q.options ?? []).length)) : q.kind === "number" ? (q.unit === "m" ? "16,2" : /an/i.test(q.t) ? "2004" : "1")
        : q.kind === "date" ? now().slice(0, 10) : q.kind === "text" ? (/prezent/i.test(q.t) ? String(r.contact_name ?? "Persoana de contact") : "[completat pe teren]") : q.def ?? q.options?.[0] ?? "";
    }
    const rooms = J<{ n: string; a: number | null }[]>(r.rooms as string, []);
    const ra = (rooms.length ? rooms : [{ n: "Hol", a: 8.2 }, { n: "Living", a: 26.4 }, { n: "Bucătărie", a: 11.4 }, { n: "Dormitor", a: 15.8 }, { n: "Baie", a: 6.9 }])
      .map((x, i) => ({ ...x, floor: ["Gresie", "Parchet", "Gresie", "Parchet", "Gresie"][i % 5], walls: ["Vopsea lavabilă", "Vopsea lavabilă", "Faianță, vopsea", "Vopsea lavabilă", "Faianță"][i % 5], state: "Bună" }));
    const start = new Date(Date.now() - 58 * 60e3).toISOString(), end = now();
    await db.prepare(`UPDATE inspections SET answers = ?, room_answers = ?, findings = ?, status = 'gata', started_at = ?, finished_at = ?, signed_name = ?, signed_at = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(answers), JSON.stringify(ra), JSON.stringify({ diff: "[diferențe față de acte]", defects: "[defecte vizibile]", notes: "[observații]" }), start, end,
        r.contact_name ?? null, end, end, id).run();
    await logIt(db, id, c.user.id, "Începută pe teren (simulare în modul de test)");
    await logIt(db, id, c.user.id, "Finalizată și semnată (simulare în modul de test)");
    return { ok: true, id };
  }
  return { error: "Acțiune necunoscută." };
}
