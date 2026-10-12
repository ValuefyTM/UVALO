// Server-only: Colaborări (occasional work between valuers). Who may use it (Dezactivat / Test / Activ, chosen in the
// administration), profiles with the coverage zone, posts, "Vreau detalii" requests, conversations, in-app notifications
// and the test data (everything written while the module is not "Activ" has test = 1 and can be deleted at once).
import { now, uuid } from "./db";
import { geocode } from "./gmaps";
import { COUNTIES, KINDS, km, POST_SPECS, PROPS, YEARS, type CollabMode, type Kind } from "./collab-shared";

/* ---------- mode and test users (app_settings "collab") ---------- */

export type CollabSettings = { mode: CollabMode; users: string[] };
let cache: { at: number; v: CollabSettings } | null = null;

export async function collabSettings(db: D1Database): Promise<CollabSettings> {
  if (cache && Date.now() - cache.at < 5000) return cache.v;
  let d: Partial<CollabSettings> = {};
  try {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = 'collab'").first<{ value: string }>();
    if (row) d = JSON.parse(row.value);
  } catch {}
  const v: CollabSettings = {
    mode: d.mode === "on" || d.mode === "test" ? d.mode : "off",
    users: Array.isArray(d.users) ? d.users.filter((x): x is string => typeof x === "string") : [],
  };
  cache = { at: Date.now(), v };
  return v;
}

export async function setCollabSettings(db: D1Database, actor: string, v: CollabSettings) {
  await db.prepare(`INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('collab', ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(JSON.stringify(v), now(), actor).run();
  cache = { at: Date.now(), v };
  return v;
}

/** Whether a person may open Colaborări: super-admins always; in Test the chosen people; when Activ, everyone with access. */
export function collabAllowed(s: CollabSettings, c: { super: boolean; userId: string; hasAccess: boolean }) {
  if (c.super) return true;
  if (s.mode === "test") return s.users.includes(c.userId);
  return s.mode === "on" && c.hasAccess;
}

/* ---------- small helpers ---------- */

const arr = (v: unknown): string[] => { try { const a = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch { return []; } };
const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const text = (v: unknown, max = 2000) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
const initials = (name: string, email: string) => (name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") : email[0] ?? "?").toUpperCase();
const specList = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

type PersonRow = { id: string; name: string; email: string; phone: string | null; anevar_no: string | null; county: string | null; specs: string | null; has_avatar: number };
const PERSON_COLS = "u.id, u.name, u.email, u.phone, u.anevar_no, u.county, u.specs, u.avatar IS NOT NULL AS has_avatar";
export type Person = { id: string; name: string; init: string; sub: string; avatar: boolean; phone?: string | null; email?: string };
function person(u: PersonRow, contact = false): Person {
  const sub = [specList(u.specs).join(", "), u.anevar_no ? `leg. ${u.anevar_no}` : null, u.county].filter(Boolean).join(" · ");
  return { id: u.id, name: u.name || u.email, init: initials(u.name, u.email), sub, avatar: !!u.has_avatar, ...(contact ? { phone: u.phone, email: u.email } : {}) };
}
async function people(db: D1Database, ids: string[]) {
  const u = [...new Set(ids)];
  if (!u.length) return new Map<string, PersonRow>();
  const { results } = await db.prepare(`SELECT ${PERSON_COLS} FROM users u WHERE u.id IN (${u.map(() => "?").join(",")})`).bind(...u).all<PersonRow>();
  return new Map(results.map((r) => [r.id, r]));
}

/** Data written now is test data unless the module is Activ. */
const testFlag = async (db: D1Database) => ((await collabSettings(db)).mode === "on" ? 0 : 1);

async function place(q: string) {
  try {
    const r = await geocode(q);
    return r && r[0] ? { lat: r[0].lat, lng: r[0].lng } : null;
  } catch {
    return null;
  }
}

export async function notify(db: D1Database, userId: string, type: string, body: string, go: Record<string, string>, test: number) {
  await db.prepare("INSERT INTO collab_notifs (user_id, type, text, go, test) VALUES (?, ?, ?, ?, ?)").bind(userId, type, body.slice(0, 300), JSON.stringify(go), test).run();
}

/* ---------- profile ---------- */

export type ProfileRow = {
  user_id: string; available: number; years: string | null; skills: string; experience: string; about: string | null; driving: number; travel: number;
  address: string | null; city: string | null; county: string | null; lat: number | null; lng: number | null; zone_mode: string; radius: number; extra: string; kinds: string;
};
export type Profile = Omit<ProfileRow, "skills" | "experience" | "extra" | "kinds"> & { skills: string[]; experience: { firm: string; role: string; period: string }[]; extra: string[]; kinds: Kind[] };

function parseProfile(r: ProfileRow): Profile {
  let exp: { firm: string; role: string; period: string }[] = [];
  try { exp = (JSON.parse(r.experience) as unknown[]).filter((e): e is { firm: string; role: string; period: string } => !!e && typeof e === "object"); } catch {}
  return { ...r, skills: arr(r.skills), experience: exp, extra: arr(r.extra), kinds: arr(r.kinds).filter((k): k is Kind => k in KINDS) };
}
export async function getProfile(db: D1Database, userId: string) {
  const r = await db.prepare("SELECT * FROM collab_profiles WHERE user_id = ?").bind(userId).first<ProfileRow>();
  return r ? parseProfile(r) : null;
}

/** Creates or updates the profile (activation and later changes). The base address is turned into coordinates. */
export async function saveProfile(db: D1Database, userId: string, b: Record<string, unknown>) {
  const cur = await getProfile(db, userId);
  const county = COUNTIES.includes(String(b.county)) ? String(b.county) : cur?.county ?? null;
  const city = b.city !== undefined ? clean(b.city, 80) || null : cur?.city ?? null;
  const address = b.address !== undefined ? clean(b.address, 160) || null : cur?.address ?? null;
  const exp = Array.isArray(b.experience)
    ? (b.experience as Record<string, unknown>[]).slice(0, 12).map((e) => ({ firm: clean(e?.firm, 100), role: clean(e?.role, 100), period: clean(e?.period, 40) })).filter((e) => e.firm || e.role)
    : cur?.experience ?? [];
  const skills = Array.isArray(b.skills) ? [...new Set((b.skills as unknown[]).map((s) => clean(s, 60)).filter(Boolean))].slice(0, 30) : cur?.skills ?? [];
  const extra = Array.isArray(b.extra) ? [...new Set((b.extra as unknown[]).map(String).filter((j) => COUNTIES.includes(j) && j !== county))] : (cur?.extra ?? []).filter((j) => j !== county);
  const kinds = Array.isArray(b.kinds) ? (b.kinds as unknown[]).map(String).filter((k) => k in KINDS) : cur?.kinds ?? ["inspectie", "raport"];
  const bool = (k: string, d: number) => (typeof b[k] === "boolean" ? (b[k] ? 1 : 0) : d);
  const radius = Number.isFinite(Number(b.radius)) ? Math.min(300, Math.max(5, Math.round(Number(b.radius)))) : cur?.radius ?? 50;
  const v = {
    available: bool("available", cur?.available ?? 1), years: YEARS.includes(String(b.years)) ? String(b.years) : cur?.years ?? null,
    skills: JSON.stringify(skills), experience: JSON.stringify(exp), about: b.about !== undefined ? text(b.about, 1200) || null : cur?.about ?? null,
    driving: bool("driving", cur?.driving ?? 0), travel: bool("travel", cur?.travel ?? 0),
    address, city, county, zone_mode: b.zone_mode === "judet" ? "judet" : b.zone_mode === "raza" ? "raza" : cur?.zone_mode ?? "raza", radius,
    extra: JSON.stringify(extra), kinds: JSON.stringify(kinds),
  };
  let lat = cur?.lat ?? null, lng = cur?.lng ?? null;
  if (!cur || cur.address !== address || cur.city !== city || cur.county !== county) {
    const p = city || address ? await place([address, city, county ? `județul ${county}` : null].filter(Boolean).join(", ")) : null;
    lat = p?.lat ?? null; lng = p?.lng ?? null;
  }
  const t = now();
  if (cur) {
    await db.prepare(`UPDATE collab_profiles SET available = ?, years = ?, skills = ?, experience = ?, about = ?, driving = ?, travel = ?, address = ?, city = ?, county = ?,
      lat = ?, lng = ?, zone_mode = ?, radius = ?, extra = ?, kinds = ?, updated_at = ? WHERE user_id = ?`)
      .bind(v.available, v.years, v.skills, v.experience, v.about, v.driving, v.travel, v.address, v.city, v.county, lat, lng, v.zone_mode, v.radius, v.extra, v.kinds, t, userId).run();
  } else {
    await db.prepare(`INSERT INTO collab_profiles (user_id, available, years, skills, experience, about, driving, travel, address, city, county, lat, lng, zone_mode, radius, extra, kinds, test, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(userId, v.available, v.years, v.skills, v.experience, v.about, v.driving, v.travel, v.address, v.city, v.county, lat, lng, v.zone_mode, v.radius, v.extra, v.kinds, await testFlag(db), t).run();
  }
  return { profile: await getProfile(db, userId), located: lat != null };
}

/* ---------- zone ---------- */

type PostRow = {
  id: string; user_id: string; kind: Kind; title: string; note: string; city: string; county: string; lat: number | null; lng: number | null; prop: string | null; spec: string | null;
  due: string | null; budget: number | null; status: string; chosen_id: string | null; test: number; created_at: string;
};

export function inZone(p: Pick<PostRow, "kind" | "county" | "lat" | "lng">, z: Profile | null) {
  if (!z || !z.available || !z.kinds.includes(p.kind)) return false;
  if (z.county && p.county === z.county) {
    if (z.zone_mode === "judet") return true;
    const d = km(z, p);
    return d == null ? true : d <= z.radius; // no coordinates: the whole county counts
  }
  return z.extra.includes(p.county);
}

/* ---------- the page's data ---------- */

export async function collabState(db: D1Database, me: { id: string }) {
  const profile = await getProfile(db, me.id);
  const [feed, mine, myReqs, convs, notifs] = await Promise.all([
    db.prepare("SELECT p.*, (SELECT COUNT(*) FROM collab_requests r WHERE r.post_id = p.id AND r.status <> 'retras') AS n FROM collab_posts p WHERE p.status = 'active' ORDER BY p.created_at DESC LIMIT 300")
      .all<PostRow & { n: number }>(),
    db.prepare("SELECT * FROM collab_posts WHERE user_id = ? ORDER BY status = 'archived', created_at DESC LIMIT 100").bind(me.id).all<PostRow>(),
    db.prepare(`SELECT r.id, r.post_id, r.status, r.created_at, r.msg FROM collab_requests r WHERE r.user_id = ? AND r.status <> 'retras' ORDER BY r.created_at DESC LIMIT 100`)
      .bind(me.id).all<{ id: string; post_id: string; status: string; created_at: string; msg: string | null }>(),
    db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM collab_messages m WHERE m.conv_id = c.id AND m.user_id IS NOT NULL AND m.user_id <> ?1
        AND m.created_at > COALESCE(CASE WHEN c.author_id = ?1 THEN c.author_read ELSE c.peer_read END, '')) AS unread,
        (SELECT body FROM collab_messages m WHERE m.conv_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
        (SELECT user_id FROM collab_messages m WHERE m.conv_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_user
      FROM collab_convs c WHERE c.author_id = ?1 OR c.peer_id = ?1 ORDER BY c.last_at DESC LIMIT 100`)
      .bind(me.id).all<{ id: string; post_id: string; request_id: string; author_id: string; peer_id: string; last_at: string; unread: number; last_body: string | null; last_user: string | null }>(),
    db.prepare("SELECT id, type, text, go, read_at, created_at FROM collab_notifs WHERE user_id = ? ORDER BY id DESC LIMIT 40").bind(me.id)
      .all<{ id: number; type: string; text: string; go: string | null; read_at: string | null; created_at: string }>(),
  ]);

  // the requests on my posts, the posts I asked about, and the posts of the conversations
  const myIds = mine.results.map((p) => p.id);
  const reqsOnMine = myIds.length
    ? (await db.prepare(`SELECT r.*, (SELECT id FROM collab_convs c WHERE c.request_id = r.id) AS conv_id FROM collab_requests r
        WHERE r.status <> 'retras' AND r.post_id IN (${myIds.map(() => "?").join(",")}) ORDER BY r.created_at`).bind(...myIds)
        .all<{ id: string; post_id: string; user_id: string; msg: string | null; status: string; created_at: string; conv_id: string | null }>()).results
    : [];
  const otherIds = [...new Set([...myReqs.results.map((r) => r.post_id), ...convs.results.map((c) => c.post_id)])].filter((id) => !myIds.includes(id));
  const others = otherIds.length ? (await db.prepare(`SELECT * FROM collab_posts WHERE id IN (${otherIds.map(() => "?").join(",")})`).bind(...otherIds).all<PostRow>()).results : [];
  const postById = new Map([...mine.results, ...others, ...feed.results].map((p) => [p.id, p]));
  const users = await people(db, [me.id, ...feed.results.map((p) => p.user_id), ...others.map((p) => p.user_id), ...reqsOnMine.map((r) => r.user_id), ...convs.results.flatMap((c) => [c.author_id, c.peer_id])]);
  const profs = reqsOnMine.length
    ? new Map((await db.prepare(`SELECT * FROM collab_profiles WHERE user_id IN (${[...new Set(reqsOnMine.map((r) => r.user_id))].map(() => "?").join(",")})`)
      .bind(...new Set(reqsOnMine.map((r) => r.user_id))).all<ProfileRow>()).results.map((r) => [r.user_id, parseProfile(r)]))
    : new Map<string, Profile>();
  const myReqByPost = new Map(myReqs.results.map((r) => [r.post_id, r]));
  const convByReq = new Map(convs.results.map((c) => [c.request_id, c]));

  const card = (p: PostRow) => ({
    id: p.id, kind: p.kind, title: p.title, note: p.note, city: p.city, county: p.county, prop: p.prop, spec: p.spec, due: p.due, budget: p.budget,
    status: p.status, created_at: p.created_at, test: !!p.test, dist: profile ? km(profile, p) : null,
  });
  const u = (id: string, contact = false) => { const r = users.get(id); return r ? person(r, contact) : { id, name: "Cont șters", init: "?", sub: "", avatar: false }; };

  return {
    me: { ...u(me.id), specs: specList(users.get(me.id)?.specs ?? null), county: users.get(me.id)?.county ?? null, anevar: users.get(me.id)?.anevar_no ?? null },
    profile,
    feed: feed.results.map((p) => ({ ...card(p), author: u(p.user_id), own: p.user_id === me.id, inZone: inZone(p, profile), requests: p.n,
      myRequest: myReqByPost.get(p.id)?.status ?? null })),
    mine: mine.results.map((p) => ({ ...card(p), chosen_id: p.chosen_id,
      requests: reqsOnMine.filter((r) => r.post_id === p.id).map((r) => {
        const pr = profs.get(r.user_id);
        return { id: r.id, msg: r.msg, status: r.status, created_at: r.created_at, conv_id: r.conv_id, user: u(r.user_id, !!r.conv_id),
          base: pr?.city ?? null, dist: pr ? km(pr, p) : null, years: pr?.years ?? null, skills: pr?.skills ?? [] };
      }) })),
    myRequests: myReqs.results.flatMap((r) => {
      const p = postById.get(r.post_id);
      if (!p) return [];
      return [{ id: r.id, status: r.status, created_at: r.created_at, msg: r.msg, post: { ...card(p), author: u(p.user_id) }, conv_id: convs.results.find((c) => c.request_id === r.id)?.id ?? null }];
    }),
    convs: convs.results.flatMap((c) => {
      const p = postById.get(c.post_id);
      if (!p) return [];
      const role = c.author_id === me.id ? "author" : "requester";
      const chosen = p.chosen_id === c.peer_id;
      return [{ id: c.id, request_id: c.request_id, role, last_at: c.last_at, unread: c.unread, last: c.last_body ? { body: c.last_body, me: c.last_user === me.id } : null,
        peer: u(role === "author" ? c.peer_id : c.author_id, true),
        post: { id: p.id, kind: p.kind, title: p.title, city: p.city, county: p.county, due: p.due, status: p.status },
        state: chosen ? "ales" : p.chosen_id ? "altul" : p.status === "archived" ? "arhivat" : "" }];
    }),
    notifs: notifs.results.map((n) => { let go = {}; try { go = JSON.parse(n.go ?? "{}"); } catch {} return { id: n.id, type: n.type, text: n.text, go, read: !!n.read_at, created_at: n.created_at }; }),
    convByReq: Object.fromEntries([...convByReq.entries()].map(([k, v]) => [k, v.id])),
  };
}

export type CollabState = Awaited<ReturnType<typeof collabState>>;

/* ---------- actions ---------- */

type Me = { id: string; name: string; email: string };
const nameOf = (m: Me) => m.name || m.email;
const fail = (error: string) => ({ error });

export async function createPost(db: D1Database, me: Me, b: Record<string, unknown>) {
  const kind = String(b.kind) as Kind;
  if (!(kind in KINDS)) return fail("Alege tipul anunțului: inspecție sau raport + inspecție.");
  const note = text(b.note, 2000), city = clean(b.city, 80), county = String(b.county ?? "");
  if (note.length < 10) return fail("Descrie lucrarea în câteva cuvinte (cel puțin 10 caractere).");
  if (!city || !COUNTIES.includes(county)) return fail("Alege localitatea și județul, ca anunțul să ajungă la colegii din zonă.");
  const prop = PROPS.includes(String(b.prop)) ? String(b.prop) : null;
  const spec = POST_SPECS.includes(String(b.spec)) ? String(b.spec) : "EPI";
  const due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) ? b.due : null;
  const budget = b.budget === null || b.budget === "" || b.budget === undefined ? null : Number.isFinite(Number(b.budget)) && Number(b.budget) > 0 ? Math.round(Number(b.budget)) : null;
  const title = clean(b.title, 120) || `${prop ?? "Proprietate"}, ${city}`;
  const p = await place(`${city}, județul ${county}`);
  const id = uuid(), test = await testFlag(db);
  await db.prepare(`INSERT INTO collab_posts (id, user_id, kind, title, note, city, county, lat, lng, prop, spec, due, budget, test) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, me.id, kind, title, note, city, county, p?.lat ?? null, p?.lng ?? null, prop, spec, due, budget, test).run();
  // in-app notification for the colleagues whose zone covers the place
  const { results } = await db.prepare("SELECT * FROM collab_profiles WHERE available = 1 AND user_id <> ?").bind(me.id).all<ProfileRow>();
  const post = { kind, county, lat: p?.lat ?? null, lng: p?.lng ?? null };
  const who = results.map(parseProfile).filter((z) => inZone(post, z));
  const label = kind === "inspectie" ? "caută ajutor la o inspecție" : "predă o lucrare (raport + inspecție)";
  for (const z of who.slice(0, 500)) await notify(db, z.user_id, "Anunț nou în zona ta", `${nameOf(me)} ${label}: ${title}, ${city}`, { view: "feed", hl: id }, test);
  return { id, notified: who.length };
}

async function postOf(db: D1Database, id: unknown) {
  return typeof id === "string" ? db.prepare("SELECT * FROM collab_posts WHERE id = ?").bind(id).first<PostRow>() : null;
}

export async function requestDetails(db: D1Database, me: Me, b: Record<string, unknown>) {
  const p = await postOf(db, b.post_id);
  if (!p || p.status !== "active") return fail("Anunțul nu mai este disponibil.");
  if (p.user_id === me.id) return fail("Este anunțul tău.");
  const msg = text(b.msg, 1000) || null;
  const old = await db.prepare("SELECT id, status FROM collab_requests WHERE post_id = ? AND user_id = ?").bind(p.id, me.id).first<{ id: string; status: string }>();
  if (old && old.status !== "retras") return fail("Ai cerut deja detalii la acest anunț.");
  const test = await testFlag(db);
  if (old) await db.prepare("UPDATE collab_requests SET status = 'nou', msg = ?, created_at = ? WHERE id = ?").bind(msg, now(), old.id).run();
  else await db.prepare("INSERT INTO collab_requests (id, post_id, user_id, msg, test) VALUES (?, ?, ?, ?, ?)").bind(uuid(), p.id, me.id, msg, test).run();
  await notify(db, p.user_id, "Cerere de detalii", `${nameOf(me)} vrea detalii despre anunțul tău „${p.title}”`, { view: "mine" }, test);
  return { ok: true };
}

export async function withdrawRequest(db: D1Database, me: Me, b: Record<string, unknown>) {
  const r = await db.prepare("SELECT id, status FROM collab_requests WHERE id = ? AND user_id = ?").bind(String(b.id ?? ""), me.id).first<{ id: string; status: string }>();
  if (!r) return fail("Cererea nu mai există.");
  if (r.status === "ales") return fail("Ai fost ales pentru această lucrare; scrie-i autorului în chat dacă renunți.");
  await db.prepare("UPDATE collab_requests SET status = 'retras' WHERE id = ?").bind(r.id).run();
  return { ok: true };
}

async function sysMessage(db: D1Database, convId: string, body: string, test: number) {
  const t = now();
  await db.batch([
    db.prepare("INSERT INTO collab_messages (conv_id, user_id, body, test, created_at) VALUES (?, NULL, ?, ?, ?)").bind(convId, body, test, t),
    db.prepare("UPDATE collab_convs SET last_at = ? WHERE id = ?").bind(t, convId),
  ]);
}

/** The author opens (or reopens) the conversation with someone who asked for details; the contact details show from now on. */
export async function openConversation(db: D1Database, me: Me, b: Record<string, unknown>) {
  const r = await db.prepare("SELECT r.*, u.name, u.email FROM collab_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?").bind(String(b.request_id ?? ""))
    .first<{ id: string; post_id: string; user_id: string; msg: string | null; status: string; name: string; email: string }>();
  const p = r ? await postOf(db, r.post_id) : null;
  if (!r || !p || p.user_id !== me.id) return fail("Cererea nu mai există.");
  const old = await db.prepare("SELECT id FROM collab_convs WHERE request_id = ?").bind(r.id).first<{ id: string }>();
  if (old) return { id: old.id };
  const id = uuid(), test = await testFlag(db);
  await db.prepare("INSERT INTO collab_convs (id, post_id, request_id, author_id, peer_id, author_read, test) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, p.id, r.id, me.id, r.user_id, now(), test).run();
  await sysMessage(db, id, `${r.name || r.email} a cerut detalii${r.msg ? `: „${r.msg}”` : "."} ${nameOf(me)} a deschis conversația.`, test);
  if (r.status === "nou") await db.prepare("UPDATE collab_requests SET status = 'contactat' WHERE id = ?").bind(r.id).run();
  await notify(db, r.user_id, "Te-a contactat", `${nameOf(me)} a deschis conversația pentru „${p.title}”`, { view: "chat", conv: id }, test);
  return { id };
}

/** The author chooses who does the work: the post goes "În lucru" and leaves the feed (it stays until archived). */
export async function pickRequest(db: D1Database, me: Me, b: Record<string, unknown>) {
  const r = await db.prepare("SELECT * FROM collab_requests WHERE id = ?").bind(String(b.request_id ?? "")).first<{ id: string; post_id: string; user_id: string; status: string }>();
  const p = r ? await postOf(db, r.post_id) : null;
  if (!r || !p || p.user_id !== me.id) return fail("Cererea nu mai există.");
  if (p.chosen_id) return fail("Ai ales deja pe cineva pentru această lucrare.");
  if (p.status === "archived") return fail("Anunțul este arhivat.");
  const test = await testFlag(db), t = now();
  await db.batch([
    db.prepare("UPDATE collab_posts SET status = 'inlucru', chosen_id = ?, updated_at = ? WHERE id = ?").bind(r.user_id, t, p.id),
    db.prepare("UPDATE collab_requests SET status = 'ales' WHERE id = ?").bind(r.id),
  ]);
  const chosen = await db.prepare("SELECT name, email FROM users WHERE id = ?").bind(r.user_id).first<{ name: string; email: string }>();
  const { results: convs } = await db.prepare("SELECT id, peer_id FROM collab_convs WHERE post_id = ?").bind(p.id).all<{ id: string; peer_id: string }>();
  for (const c of convs) await sysMessage(db, c.id, c.peer_id === r.user_id ? `${chosen?.name || chosen?.email} a fost ales pentru această lucrare. Lucrarea e acum „În lucru”.` : "Lucrarea a fost atribuită altui coleg.", test);
  await notify(db, r.user_id, "Ai fost ales", `${nameOf(me)} te-a ales pentru lucrarea „${p.title}”`, convs.find((c) => c.peer_id === r.user_id) ? { view: "chat", conv: convs.find((c) => c.peer_id === r.user_id)!.id } : { view: "mine", tab: "req" }, test);
  const { results: rest } = await db.prepare("SELECT user_id FROM collab_requests WHERE post_id = ? AND id <> ? AND status <> 'retras'").bind(p.id, r.id).all<{ user_id: string }>();
  for (const x of rest) await notify(db, x.user_id, "Lucrare atribuită", `Lucrarea „${p.title}” a fost atribuită altui coleg`, { view: "mine", tab: "req" }, test);
  return { ok: true };
}

export async function setPostStatus(db: D1Database, me: Me, b: Record<string, unknown>) {
  const p = await postOf(db, b.post_id);
  if (!p || p.user_id !== me.id) return fail("Anunțul nu mai există.");
  const status = b.archive ? "archived" : p.chosen_id ? "inlucru" : "active";
  await db.prepare("UPDATE collab_posts SET status = ?, updated_at = ? WHERE id = ?").bind(status, now(), p.id).run();
  return { ok: true, status };
}

async function myConv(db: D1Database, me: Me, id: unknown) {
  const c = typeof id === "string" ? await db.prepare("SELECT * FROM collab_convs WHERE id = ?").bind(id).first<{ id: string; author_id: string; peer_id: string; test: number }>() : null;
  return c && (c.author_id === me.id || c.peer_id === me.id) ? c : null;
}

export async function messages(db: D1Database, me: Me, convId: string) {
  const c = await myConv(db, me, convId);
  if (!c) return null;
  const { results } = await db.prepare("SELECT id, user_id, body, created_at FROM collab_messages WHERE conv_id = ? ORDER BY id LIMIT 500").bind(c.id)
    .all<{ id: number; user_id: string | null; body: string; created_at: string }>();
  await db.prepare(`UPDATE collab_convs SET ${c.author_id === me.id ? "author_read" : "peer_read"} = ? WHERE id = ?`).bind(now(), c.id).run();
  return results.map((m) => ({ id: m.id, body: m.body, sys: m.user_id === null, me: m.user_id === me.id, at: m.created_at }));
}

export async function sendMessage(db: D1Database, me: Me, b: Record<string, unknown>) {
  const c = await myConv(db, me, b.conv_id);
  if (!c) return fail("Conversația nu mai există.");
  const body = text(b.body, 2000);
  if (!body) return fail("Scrie un mesaj.");
  const t = now(), test = await testFlag(db);
  await db.batch([
    db.prepare("INSERT INTO collab_messages (conv_id, user_id, body, test, created_at) VALUES (?, ?, ?, ?, ?)").bind(c.id, me.id, body, test, t),
    db.prepare(`UPDATE collab_convs SET last_at = ?, ${c.author_id === me.id ? "author_read" : "peer_read"} = ? WHERE id = ?`).bind(t, t, c.id),
  ]);
  return { ok: true };
}

export async function readNotifs(db: D1Database, me: Me, b: Record<string, unknown>) {
  if (typeof b.id === "number") await db.prepare("UPDATE collab_notifs SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL").bind(now(), b.id, me.id).run();
  else await db.prepare("UPDATE collab_notifs SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(now(), me.id).run();
  return { ok: true };
}

/* ---------- administration ---------- */

const TABLES = ["collab_messages", "collab_convs", "collab_requests", "collab_notifs", "collab_posts", "collab_profiles"] as const;

export async function collabCounts(db: D1Database) {
  const rows = await Promise.all(TABLES.map((t) => db.prepare(`SELECT COUNT(*) AS n, SUM(test) AS t FROM ${t}`).first<{ n: number; t: number | null }>()));
  return Object.fromEntries(TABLES.map((t, i) => [t.replace("collab_", ""), { all: rows[i]?.n ?? 0, test: rows[i]?.t ?? 0 }])) as Record<string, { all: number; test: number }>;
}

/** Deletes everything written in test mode (children first; a real row that points to test data goes too). */
export async function purgeTest(db: D1Database) {
  const before = await collabCounts(db);
  await db.batch([
    db.prepare(`DELETE FROM collab_messages WHERE test = 1 OR conv_id IN (SELECT id FROM collab_convs WHERE test = 1 OR post_id IN (SELECT id FROM collab_posts WHERE test = 1)
      OR request_id IN (SELECT id FROM collab_requests WHERE test = 1))`),
    db.prepare("DELETE FROM collab_convs WHERE test = 1 OR post_id IN (SELECT id FROM collab_posts WHERE test = 1) OR request_id IN (SELECT id FROM collab_requests WHERE test = 1)"),
    db.prepare("DELETE FROM collab_requests WHERE test = 1 OR post_id IN (SELECT id FROM collab_posts WHERE test = 1)"),
    db.prepare("DELETE FROM collab_notifs WHERE test = 1"),
    db.prepare("DELETE FROM collab_posts WHERE test = 1"),
    db.prepare("DELETE FROM collab_profiles WHERE test = 1"),
  ]);
  return Object.values(before).reduce((s, x) => s + x.test, 0);
}

export async function testUsers(db: D1Database, ids: string[]) {
  const m = await people(db, ids);
  return ids.map((id) => { const r = m.get(id); return { id, name: r ? r.name || r.email : "Cont șters", email: r?.email ?? "", anevar: r?.anevar_no ?? null }; });
}
