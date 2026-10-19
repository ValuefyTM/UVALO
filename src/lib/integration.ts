// Server-only: the integration API (/api/v1/*). A firm's own software (e.g. its CRM) works with a key from "Firma mea":
// it sends inspections to the firm's valuers (found by their ANEVAR card — they get them directly on the phone, no request to
// accept), keeps the firm's sheets in sync (the software is their source: they are read-only in UVALO), adds documents and reads
// the finished sheets. Every change on such an inspection is posted to the firm's webhook, signed with its secret.
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, getFiles, now, uuid } from "./db";
import { randomToken, sha256 } from "./crypto";
import { geocode } from "./gmaps";
import { notifyUser } from "./webpush";
import { logIt, nextCode } from "./insp";
import { cleanTemplate, qCount, UVALO_TEMPLATES, type Template } from "./insp-shared";

export type ApiKey = { id: string; org_id: string; created_by: string; name: string };

const s = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const t = (v: unknown, max = 4000) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
const num = (v: unknown) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : null; };
const J = <T>(v: unknown, d: T): T => { try { return typeof v === "string" && v ? (JSON.parse(v) as T) : d; } catch { return d; } };

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** The key in `Authorization: Bearer uvk_…`: its firm (and who created it, who stands for the firm's work). */
export async function keyApi(req: Request): Promise<{ db: D1Database; key: ApiKey } | { res: NextResponse }> {
  const db = await getDb();
  if (!db) return { res: fail("Baza de date nu este disponibilă.", 503) };
  const raw = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^uvk_[A-Za-z0-9_-]{20,80}$/.test(raw)) return { res: fail("Cheie API lipsă sau greșită.", 401) };
  const key = await db.prepare(`SELECT k.id, k.org_id, k.created_by, k.name FROM api_keys k JOIN orgs o ON o.id = k.org_id
    WHERE k.key_hash = ? AND k.revoked_at IS NULL AND o.status = 'active'`).bind(await sha256(raw)).first<ApiKey>();
  if (!key) return { res: fail("Cheie API necunoscută sau revocată.", 401) };
  await db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), key.id).run();
  return { db, key };
}

/* ---------- keys (panel in "Firma mea") ---------- */

export async function listKeys(db: D1Database, orgId: string) {
  const keys = (await db.prepare(`SELECT k.id, k.name, k.prefix, k.webhook_url, k.created_at, k.last_used_at, COALESCE(NULLIF(u.name, ''), u.email) AS by_name
    FROM api_keys k LEFT JOIN users u ON u.id = k.created_by WHERE k.org_id = ? AND k.revoked_at IS NULL ORDER BY k.created_at`).bind(orgId)
    .all<{ id: string; name: string; prefix: string; webhook_url: string | null; created_at: string; last_used_at: string | null; by_name: string | null }>()).results;
  const hooks = keys.length ? (await db.prepare(`SELECT key_id, event, status, error, at FROM api_hooks WHERE key_id IN (${keys.map(() => "?").join(", ")}) ORDER BY at DESC LIMIT 20`)
    .bind(...keys.map((k) => k.id)).all<{ key_id: string; event: string; status: number | null; error: string | null; at: string }>()).results : [];
  return keys.map((k) => ({ ...k, hooks: hooks.filter((h) => h.key_id === k.id).slice(0, 5) }));
}

export async function keyAction(db: D1Database, orgId: string, userId: string, b: Record<string, unknown>)
  : Promise<{ ok: true; key?: string; secret?: string } | { error: string }> {
  const action = s(b.action, 20);
  if (action === "create") {
    const raw = `uvk_${randomToken()}`, id = uuid();
    await db.prepare("INSERT INTO api_keys (id, org_id, name, prefix, key_hash, created_by) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, orgId, s(b.name, 60) || "Integrare", raw.slice(0, 10), await sha256(raw), userId).run();
    return { ok: true, key: raw };
  }
  const k = await db.prepare("SELECT id FROM api_keys WHERE id = ? AND org_id = ? AND revoked_at IS NULL").bind(s(b.id, 64), orgId).first<{ id: string }>();
  if (!k) return { error: "Cheia nu există." };
  if (action === "revoke") {
    await db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").bind(now(), k.id).run();
    return { ok: true };
  }
  if (action === "webhook") {
    const url = s(b.url, 300);
    if (url && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) return { error: "Adresa webhook-ului trebuie să înceapă cu https://." };
    // a new secret when asked (or when the webhook is set the first time); shown once
    const fresh = b.new_secret === true || (url && !(await db.prepare("SELECT webhook_secret FROM api_keys WHERE id = ?").bind(k.id).first<{ webhook_secret: string | null }>())?.webhook_secret);
    const secret = fresh ? `whs_${randomToken()}` : null;
    await db.prepare("UPDATE api_keys SET webhook_url = ?, webhook_secret = COALESCE(?, webhook_secret) WHERE id = ?").bind(url || null, secret, k.id).run();
    return { ok: true, ...(secret ? { secret } : {}) };
  }
  return { error: "Acțiune necunoscută." };
}

/* ---------- valuers (by the ANEVAR card) ---------- */

const legitKey = (v: unknown) => s(v, 40).toUpperCase().replace(/[\s.\-/]/g, "");

/** The UVALO account with this ANEVAR card (active), and whether its phone app is connected. */
export async function inspectorByLegit(db: D1Database, legit: unknown) {
  const k = legitKey(legit);
  if (!k) return null;
  const u = await db.prepare(`SELECT id, COALESCE(NULLIF(name, ''), email) AS name, anevar_no FROM users
    WHERE UPPER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(anevar_no, ''), ' ', ''), '.', ''), '-', ''), '/', '')) = ? AND status = 'active' ORDER BY last_seen_at DESC LIMIT 1`)
    .bind(k).first<{ id: string; name: string; anevar_no: string }>();
  if (!u) return null;
  const phone = await db.prepare("SELECT 1 AS x FROM insp_devices WHERE user_id = ? AND revoked_at IS NULL LIMIT 1").bind(u.id).first();
  return { id: u.id, name: u.name, legit: u.anevar_no, phone: !!phone };
}

/* ---------- sheets (templates) kept in sync by the software ---------- */

export async function extTemplates(db: D1Database, key: ApiKey) {
  const { results } = await db.prepare(`SELECT id, ext_ref, name, prop_type, version, enforced, updated_at FROM insp_templates
    WHERE owner_type = 'org' AND owner_id = ? AND deleted_at IS NULL AND version > 0 ORDER BY name`).bind(key.org_id)
    .all<{ id: string; ext_ref: string | null; name: string; prop_type: string | null; version: number; enforced: number; updated_at: string }>();
  return [...results.map((r) => ({ ...r, source: r.ext_ref ? "api" : "uvalo_firm" })),
    ...UVALO_TEMPLATES.map((u) => ({ id: `uvalo:${u.key}`, ext_ref: null, name: u.name, prop_type: u.prop, version: 1, enforced: 0, updated_at: "", source: "uvalo" }))];
}

/** Creates or replaces the firm's sheet with this ref (published at once, as a new version when it changed). */
export async function putTemplate(db: D1Database, key: ApiKey, ref: string, b: Record<string, unknown>) {
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return { error: "Referință de fișă invalidă." };
  const tpl = cleanTemplate(b.template);
  if (!qCount(tpl)) return { error: "Fișa trebuie să aibă cel puțin o întrebare." };
  const name = s(b.name, 80) || "Fișă", prop = s(b.prop_type, 60) || null, json = JSON.stringify(tpl), ts = now();
  const old = await db.prepare("SELECT id, published FROM insp_templates WHERE owner_type = 'org' AND owner_id = ? AND ext_ref = ? AND deleted_at IS NULL")
    .bind(key.org_id, ref).first<{ id: string; published: string | null }>();
  if (old) {
    const changed = old.published !== json;
    await db.prepare(`UPDATE insp_templates SET name = ?, prop_type = ?, draft = ?, published = ?, version = version + ?, enforced = ?, updated_at = ? WHERE id = ?`)
      .bind(name, prop, json, json, changed ? 1 : 0, b.enforced ? 1 : 0, ts, old.id).run();
    return { ok: true as const, id: old.id };
  }
  const id = uuid();
  await db.prepare(`INSERT INTO insp_templates (id, owner_type, owner_id, name, prop_type, draft, published, version, enforced, created_by, ext_ref, updated_at)
    VALUES (?, 'org', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).bind(id, key.org_id, name, prop, json, json, b.enforced ? 1 : 0, key.created_by, ref, ts).run();
  return { ok: true as const, id };
}

export async function deleteTemplate(db: D1Database, key: ApiKey, ref: string) {
  const r = await db.prepare("UPDATE insp_templates SET deleted_at = ? WHERE owner_type = 'org' AND owner_id = ? AND ext_ref = ? AND deleted_at IS NULL").bind(now(), key.org_id, ref).run();
  return r.meta.changes ? { ok: true as const } : { error: "Fișa nu există." };
}

/** The sheet chosen for an inspection: the firm's (by ref or id) or a UVALO one (`uvalo:<key>`); its published version. */
async function pickTemplate(db: D1Database, key: ApiKey, b: Record<string, unknown>) {
  const ref = s(b.template_ref, 80), id = s(b.template_id, 80);
  if (id.startsWith("uvalo:")) {
    const u = UVALO_TEMPLATES.find((x) => `uvalo:${x.key}` === id);
    return u ? { id, name: u.name, prop: u.prop, version: 1, tpl: u.tpl } : null;
  }
  const r = await db.prepare(`SELECT id, name, prop_type, version, published FROM insp_templates WHERE owner_type = 'org' AND owner_id = ? AND deleted_at IS NULL AND version > 0
    AND ${ref ? "ext_ref = ?" : "id = ?"}`).bind(key.org_id, ref || id).first<{ id: string; name: string; prop_type: string | null; version: number; published: string }>();
  if (r) return { id: r.id, name: r.name, prop: r.prop_type, version: r.version, tpl: cleanTemplate(J<Template>(r.published, { groups: [] })) };
  // none given: by the type of the property, the firm's enforced sheet, else the UVALO one of that type
  if (ref || id) return null;
  const u = UVALO_TEMPLATES.find((x) => x.prop.toLowerCase() === s(b.prop_type, 60).toLowerCase()) ?? UVALO_TEMPLATES[0];
  return { id: `uvalo:${u.key}`, name: u.name, prop: u.prop, version: 1, tpl: u.tpl };
}

/* ---------- inspections ---------- */

const extRow = (db: D1Database, key: ApiKey, idOrRef: string) => db.prepare(`SELECT * FROM inspections WHERE org_id = ? AND (id = ? OR ext_ref = ?) AND deleted_at IS NULL
  ORDER BY created_at DESC LIMIT 1`).bind(key.org_id, idOrRef, idOrRef).first<Record<string, unknown>>();

type Fact = { label: string; value: string; keys: string[] };

/** The property's details sent by the firm: `[{ label, value, keys? }]` (keys: question ids that ask the same, e.g. "vin"). */
function cleanFacts(v: unknown): Fact[] {
  return (Array.isArray(v) ? v : []).slice(0, 40).map((x: { label?: unknown; value?: unknown; keys?: unknown }) => ({
    label: s(x?.label, 80), value: s(typeof x?.value === "number" ? String(x.value) : x?.value, 200),
    keys: Array.isArray(x?.keys) ? x.keys.map((k: unknown) => s(k, 40)).filter(Boolean).slice(0, 8) : [],
  })).filter((x) => x.label && x.value);
}

const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The answers the firm's details give: a question with the id of a fact (or the same text) gets its value, when it fits the question. */
function prefill(tpl: Template, facts: Fact[]): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const g of tpl.groups) for (const q of g.qs) {
    const f = facts.find((x) => x.keys.includes(q.id)) ?? facts.find((x) => norm(x.label) === norm(q.t));
    if (!f) continue;
    if (q.kind === "number") { const n = f.value.replace(/[^\d.,-]/g, "").replace(",", "."); if (n) out[q.id] = n; }
    else if (q.kind === "one" || q.kind === "comp") { const o = (q.options ?? []).find((x) => norm(x) === norm(f.value)); if (o) out[q.id] = o; }
    else if (q.kind === "many") { const o = (q.options ?? []).filter((x) => f.value.split(/,\s*/).some((v) => norm(v) === norm(x))); if (o.length) out[q.id] = o; }
    else if (q.kind === "text") out[q.id] = f.value;
  }
  return out;
}

/**
 * Creates the inspection (or updates the one with the same `ref`, while it is not finished): the valuer is found by `legit`
 * (ANEVAR card) and gets it directly. A finished one is not changed: a new inspection of the same property comes with a new ref.
 */
export async function putInspection(db: D1Database, key: ApiKey, b: Record<string, unknown>): Promise<{ ok: true; id: string; code: string; created: boolean } | { error: string; status?: number }> {
  const ref = s(b.ref, 80);
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return { error: "Lipsește `ref` (id-ul inspecției în aplicația voastră)." };
  const address = s(b.address, 200);
  if (address.length < 5) return { error: "Lipsește adresa bunului." };
  const who = await inspectorByLegit(db, b.legit);
  if (!who) return { error: `Nu există cont UVALO activ cu legitimația ${s(b.legit, 40) || "(lipsă)"}.`, status: 422 };
  const tpl = await pickTemplate(db, key, b);
  if (!tpl) return { error: "Fișa aleasă nu există (sau nu e publicată).", status: 422 };
  const old = await db.prepare("SELECT * FROM inspections WHERE org_id = ? AND ext_ref = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .bind(key.org_id, ref).first<Record<string, unknown>>();
  if (old && (old.status === "gata" || old.status === "pred")) return { error: "Inspecția e finalizată și nu se mai modifică; pentru una nouă trimite alt `ref`.", status: 409 };
  const rooms = (Array.isArray(b.rooms) ? b.rooms : []).slice(0, 60).map((x: { n?: unknown; a?: unknown }) => ({ n: s(x?.n, 60), a: num(x?.a) })).filter((x) => x.n);
  const due = s(b.due_on, 10);
  const notes = [t(b.instructions, 1800), /^\d{4}-\d{2}-\d{2}$/.test(due) ? `Termen: ${due.split("-").reverse().join(".")}` : ""].filter(Boolean).join("\n") || null;
  const v = {
    address, cad_nr: s(b.cad_nr, 40) || null, cf_nr: s(b.cf_nr, 60) || null, uat: s(b.uat, 80) || null, county: s(b.county, 40) || null, lat: num(b.lat), lng: num(b.lng),
    prop_type: s(b.prop_type, 60) || tpl.prop, area_util: num(b.area_util), area_land: num(b.area_land),
    contact_name: s(b.contact_name, 120) || null, contact_phone: s(b.contact_phone, 40) || null, contact_role: s(b.contact_role, 60) || null,
  };
  if (v.lat == null) { const g = await geocode(address).catch(() => null); if (g?.[0]) { v.lat = g[0].lat; v.lng = g[0].lng; } }
  const facts = cleanFacts(b.facts);
  const ts = now();
  if (old) {
    const id = String(old.id), moved = old.assignee_id !== who.id;
    // the sheet chosen is kept once filling it started (its answers belong to it)
    const keepTpl = !!old.sheet_no || old.status === "lucru";
    await db.prepare(`UPDATE inspections SET address = ?, cad_nr = ?, cf_nr = ?, uat = ?, county = ?, lat = ?, lng = ?, prop_type = ?, area_util = ?, area_land = ?, rooms = ?,
      contact_name = ?, contact_phone = ?, contact_role = ?, notes = ?, assignee_id = ?, assignee_kind = 'office', assign_state = NULL,
      template_id = CASE WHEN ? THEN template_id ELSE ? END, template_name = CASE WHEN ? THEN template_name ELSE ? END,
      template_version = CASE WHEN ? THEN template_version ELSE ? END, template = CASE WHEN ? THEN template ELSE ? END,
      status = CASE WHEN ? AND status = 'plan' THEN 'prog' ELSE status END, scheduled_at = CASE WHEN ? AND status = 'plan' THEN NULL ELSE scheduled_at END, updated_at = ? WHERE id = ?`)
      .bind(v.address, v.cad_nr, v.cf_nr, v.uat, v.county, v.lat, v.lng, v.prop_type, v.area_util, v.area_land, JSON.stringify(rooms),
        v.contact_name, v.contact_phone, v.contact_role, notes, who.id,
        keepTpl ? 1 : 0, tpl.id, keepTpl ? 1 : 0, tpl.name, keepTpl ? 1 : 0, tpl.version, keepTpl ? 1 : 0, JSON.stringify(tpl.tpl),
        moved ? 1 : 0, moved ? 1 : 0, ts, id).run();
    await db.prepare("UPDATE inspections SET facts = ? WHERE id = ?").bind(JSON.stringify(facts), id).run();
    if (!keepTpl && !old.started_at) await db.prepare("UPDATE inspections SET answers = ? WHERE id = ?").bind(JSON.stringify(prefill(tpl.tpl, facts)), id).run();
    if (moved) {
      await logIt(db, id, key.created_by, `Realocată lui ${who.name}`);
      const prev = old.assignee_id ? String(old.assignee_id) : null;
      if (prev) {
        const p = notifyUser(db, prev, { title: "Inspecție realocată", body: `${[old.prop_type, old.address].filter(Boolean).join(" · ")}\nA fost dată altcuiva`, url: "/", tag: `insp-${id}` }).catch(() => {});
        try { (await getCloudflareContext({ async: true })).ctx.waitUntil(p); } catch { await p; }
      }
    } else await logIt(db, id, key.created_by, "Modificată din aplicația firmei");
    return { ok: true, id, code: String(old.code), created: false };
  }
  const id = uuid(), code = await nextCode(db);
  await db.prepare(`INSERT INTO inspections (id, code, created_by, org_id, assignee_id, assignee_kind, assign_state, status, address, cad_nr, cf_nr, uat, county, lat, lng,
    prop_type, area_util, area_land, rooms, template_id, template_name, template_version, template, contact_name, contact_phone, contact_role, notes, test, ext_ref, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'office', NULL, 'prog', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
    .bind(id, code, key.created_by, key.org_id, who.id, v.address, v.cad_nr, v.cf_nr, v.uat, v.county, v.lat, v.lng, v.prop_type, v.area_util, v.area_land,
      JSON.stringify(rooms), tpl.id, tpl.name, tpl.version, JSON.stringify(tpl.tpl), v.contact_name, v.contact_phone, v.contact_role, notes, ref, ts, ts).run();
  await db.prepare("UPDATE inspections SET facts = ?, answers = ? WHERE id = ?").bind(JSON.stringify(facts), JSON.stringify(prefill(tpl.tpl, facts)), id).run();
  await logIt(db, id, key.created_by, "Creată din aplicația firmei");
  return { ok: true, id, code, created: true };
}

/** Everything about the inspection: state, the sheet (template snapshot + answers), rooms, findings, signature, files. */
export async function extInspection(db: D1Database, key: ApiKey, idOrRef: string) {
  const r = await extRow(db, key, idOrRef);
  if (!r) return null;
  const [files, who] = await Promise.all([
    db.prepare("SELECT id, kind, name, room, taken_at, lat, lng, meta FROM insp_files WHERE inspection_id = ? ORDER BY taken_at, created_at").bind(r.id)
      .all<{ id: string; kind: string; name: string | null; room: string | null; taken_at: string | null; lat: number | null; lng: number | null; meta: string | null }>(),
    r.assignee_id ? db.prepare("SELECT COALESCE(NULLIF(name, ''), email) AS name, anevar_no FROM users WHERE id = ?").bind(r.assignee_id).first<{ name: string; anevar_no: string | null }>() : null,
  ]);
  return {
    id: r.id, ref: r.ext_ref, code: r.code, status: r.status, address: r.address, cad_nr: r.cad_nr, cf_nr: r.cf_nr, prop_type: r.prop_type, lat: r.lat, lng: r.lng,
    inspector: who ? { name: who.name, legit: who.anevar_no } : null,
    scheduled_at: r.scheduled_at, duration_min: r.duration_min, started_at: r.started_at, finished_at: r.finished_at,
    sheet: { no: r.sheet_no, at: r.sheet_at, rev: r.sheet_rev, template: { id: r.template_id, name: r.template_name, version: r.template_version, ...cleanTemplate(J(r.template, {})) },
      facts: J(r.facts, []), answers: J(r.answers, {}), rooms: J(r.room_answers, []), findings: J(r.findings, {}), signed_name: r.signed_name, signed_at: r.signed_at,
      cover_file_id: r.cover_file_id, redo_note: r.redo_note },
    contact: { name: r.contact_name, phone: r.contact_phone, role: r.contact_role }, notes: r.notes,
    files: files.results.map((f) => ({ id: f.id, kind: f.kind, name: f.name, room: f.room, taken_at: f.taken_at, lat: f.lat, lng: f.lng, type: J<{ type?: string }>(f.meta, {}).type ?? null })),
    updated_at: r.updated_at,
  };
}

/**
 * Taken back by the software (the work no longer needs it): it leaves the valuer's phone, the history stays. A finished one
 * only with `force` (the firm deleted the inspection and its sheet in its software: it goes from everywhere).
 */
export async function cancelInspection(db: D1Database, key: ApiKey, idOrRef: string, reason: string, force = false) {
  const r = await extRow(db, key, idOrRef);
  if (!r) return { error: "Inspecția nu există.", status: 404 };
  if (!force && (r.status === "gata" || r.status === "pred")) return { error: "Inspecția e finalizată și nu se mai anulează (doar ștearsă, cu force=1).", status: 409 };
  await logIt(db, String(r.id), key.created_by, `Inspecția a fost ștearsă${reason ? `: ${reason}` : " (anulată din aplicația firmei)"}`);
  await db.prepare("UPDATE inspections SET deleted_at = ? WHERE id = ?").bind(now(), r.id).run();
  return { ok: true as const };
}

/** A document for the inspection (CF extract, floor plan, other): the valuer sees it on the phone. */
/**
 * A message from the firm's app to the valuer of an inspection that is not finished (e.g. its documents were updated):
 * kept in the inspection's history and sent as a phone notification. `{ title?: "docs" | "info", text }`.
 */
export async function extNotify(db: D1Database, key: ApiKey, idOrRef: string, b: Record<string, unknown>) {
  const r = await extRow(db, key, idOrRef);
  if (!r) return { error: "Inspecția nu există.", status: 404 };
  if (r.status === "gata" || r.status === "pred") return { error: "Inspecția e finalizată.", status: 409 };
  const text = t(b.text, 300);
  if (!text) return { error: "Lipsește textul notificării." };
  await logIt(db, String(r.id), key.created_by, `${b.title === "docs" ? "Acte actualizate" : "Mesaj de la firmă"}: ${text}`);
  return { ok: true as const };
}

export async function extAddFile(db: D1Database, key: ApiKey, idOrRef: string, f: File, kind: string, name: string) {
  const r = await extRow(db, key, idOrRef);
  if (!r) return { error: "Inspecția nu există.", status: 404 };
  const bucket = await getFiles();
  if (!bucket) return { error: "Stocarea fișierelor nu este disponibilă.", status: 503 };
  const ext = ({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[f.type];
  if (!ext) return { error: "Fișierul trebuie să fie PDF sau imagine (JPG, PNG, WEBP)." };
  if (f.size > 15 * 1024 * 1024) return { error: "Fișierul are peste 15 MB." };
  const k = ["cf", "releveu", "doc"].includes(kind) ? kind : "doc";
  const id = uuid(), r2 = `insp/${r.id}/${id}.${ext}`;
  await bucket.put(r2, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
  await db.prepare("INSERT INTO insp_files (id, inspection_id, kind, name, r2_key, meta) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, r.id, k, s(name || f.name, 120) || null, r2, JSON.stringify({ type: f.type, size: f.size, by: key.created_by, api: key.id })).run();
  await logIt(db, String(r.id), key.created_by, `Document adăugat: ${s(name || f.name, 80) || k}`);
  return { ok: true as const, id };
}

/** A file of one of the firm's inspections (photos, signature, documents), for download. */
export async function extFile(db: D1Database, key: ApiKey, fileId: string) {
  return db.prepare(`SELECT f.id, f.name, f.r2_key, f.meta FROM insp_files f JOIN inspections i ON i.id = f.inspection_id WHERE f.id = ? AND i.org_id = ?`)
    .bind(fileId, key.org_id).first<{ id: string; name: string | null; r2_key: string; meta: string | null }>();
}

/* ---------- webhook ---------- */

async function hmac(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg))), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Something happened on an inspection made through the API (`text` = the history line): the firm's webhooks get
 * `{event, id, ref, status, …}`, signed `X-Uvalo-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`. The software then
 * reads the inspection with GET /api/v1/inspections/<id>.
 */
export async function postHook(db: D1Database, inspId: string, text: string) {
  if (/^(Fotografie adăugat|Fișier șters|Link public)/.test(text)) return; // the photos come with the finished sheet
  const r = await db.prepare("SELECT id, org_id, ext_ref, status, scheduled_at, started_at, finished_at, sheet_no, deleted_at FROM inspections WHERE id = ?").bind(inspId)
    .first<{ id: string; org_id: string | null; ext_ref: string | null; status: string; scheduled_at: string | null; started_at: string | null; finished_at: string | null; sheet_no: string | null; deleted_at: string | null }>();
  if (!r?.ext_ref || !r.org_id) return;
  const keys = (await db.prepare("SELECT id, webhook_url, webhook_secret FROM api_keys WHERE org_id = ? AND revoked_at IS NULL AND webhook_url IS NOT NULL AND webhook_secret IS NOT NULL")
    .bind(r.org_id).all<{ id: string; webhook_url: string; webhook_secret: string }>()).results;
  if (!keys.length) return;
  const event = /ștearsă/.test(text) ? "inspection.deleted" : /^Creată/.test(text) ? "inspection.created" : /^Finalizat|^Completată|semnată/i.test(text) ? "inspection.finished" : /^Programată/.test(text) ? "inspection.scheduled"
    : /^Începută/.test(text) ? "inspection.started" : /^Retrimisă/.test(text) ? "inspection.reopened" : "inspection.updated";
  const body = JSON.stringify({ event, id: r.id, ref: r.ext_ref, status: r.deleted_at || event === "inspection.deleted" ? "deleted" : r.status, scheduled_at: r.scheduled_at, started_at: r.started_at,
    finished_at: r.finished_at, sheet_no: r.sheet_no, text, at: now() });
  const ts = Math.floor(Date.now() / 1000);
  for (const k of keys) {
    let status: number | null = null, error: string | null = null;
    try {
      const res = await fetch(k.webhook_url, { method: "POST", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", "User-Agent": "UVALO-Webhook/1", "X-Uvalo-Event": event, "X-Uvalo-Signature": `t=${ts},v1=${await hmac(k.webhook_secret, `${ts}.${body}`)}` }, body });
      status = res.status;
      if (!res.ok) error = (await res.text().catch(() => "")).slice(0, 200) || null;
    } catch (e) { error = String((e as Error)?.message ?? e).slice(0, 200); }
    await db.batch([
      db.prepare("INSERT INTO api_hooks (key_id, inspection_id, event, status, error) VALUES (?, ?, ?, ?, ?)").bind(k.id, r.id, event, status, error),
      db.prepare("DELETE FROM api_hooks WHERE key_id = ? AND id NOT IN (SELECT id FROM api_hooks WHERE key_id = ? ORDER BY id DESC LIMIT 200)").bind(k.id, k.id),
    ]);
  }
}
