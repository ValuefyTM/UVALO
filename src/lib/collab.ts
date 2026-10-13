// Server-only: Colaborări (occasional work between valuers). Who may use it (Dezactivat / Test / Activ, chosen in the
// administration), profiles with the coverage zone, posts, "Vreau detalii" requests, conversations, in-app notifications
// and the test data (everything written while the module is not "Activ" has test = 1 and can be deleted at once).
import { now, uuid } from "./db";
import { geocode } from "./gmaps";
import { magicLink } from "./auth";
import { esc, greetName, layout, sendEmails } from "./email";
import { origin } from "./site";
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
  email_notif: number;
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
    available: bool("available", cur?.available ?? 1), email_notif: bool("email_notif", cur?.email_notif ?? 1), years: YEARS.includes(String(b.years)) ? String(b.years) : cur?.years ?? null,
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
    await db.prepare(`UPDATE collab_profiles SET available = ?, email_notif = ?, years = ?, skills = ?, experience = ?, about = ?, driving = ?, travel = ?, address = ?, city = ?, county = ?,
      lat = ?, lng = ?, zone_mode = ?, radius = ?, extra = ?, kinds = ?, updated_at = ? WHERE user_id = ?`)
      .bind(v.available, v.email_notif, v.years, v.skills, v.experience, v.about, v.driving, v.travel, v.address, v.city, v.county, lat, lng, v.zone_mode, v.radius, v.extra, v.kinds, t, userId).run();
  } else {
    await db.prepare(`INSERT INTO collab_profiles (user_id, available, email_notif, years, skills, experience, about, driving, travel, address, city, county, lat, lng, zone_mode, radius, extra, kinds, test, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(userId, v.available, v.email_notif, v.years, v.skills, v.experience, v.about, v.driving, v.travel, v.address, v.city, v.county, lat, lng, v.zone_mode, v.radius, v.extra, v.kinds, await testFlag(db), t).run();
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

/** For the menu: active posts in the person's zones, not their own and not asked about yet. */
export async function relevantCount(db: D1Database, userId: string) {
  const z = await getProfile(db, userId);
  if (!z || !z.available) return 0;
  const { results } = await db.prepare("SELECT kind, county, lat, lng FROM collab_posts p WHERE p.status = 'active' AND p.user_id <> ?1 LIMIT 500")
    .bind(userId).all<Pick<PostRow, "kind" | "county" | "lat" | "lng">>();
  return results.filter((p) => inZone(p, z)).length;
}

/* ---------- the page's data ---------- */

export async function collabState(db: D1Database, me: { id: string }) {
  const profile = await getProfile(db, me.id);
  const [feed, mine, myReqs, convs, notifs, act] = await Promise.all([
    db.prepare("SELECT p.*, (SELECT COUNT(*) FROM collab_requests r WHERE r.post_id = p.id AND r.status <> 'retras') AS n FROM collab_posts p WHERE p.status = 'active' ORDER BY p.created_at DESC LIMIT 300")
      .all<PostRow & { n: number }>(),
    db.prepare("SELECT * FROM collab_posts WHERE user_id = ? AND status <> 'deleted' ORDER BY status = 'archived', created_at DESC LIMIT 100").bind(me.id).all<PostRow>(),
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
    activatedCount(db),
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
      if (!p || p.status === "deleted") return [];
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
        state: p.status === "deleted" ? "sters" : chosen ? "ales" : p.chosen_id ? "altul" : p.status === "archived" ? "arhivat" : "" }];
    }),
    notifs: notifs.results.map((n) => { let go = {}; try { go = JSON.parse(n.go ?? "{}"); } catch {} return { id: n.id, type: n.type, text: n.text, go, read: !!n.read_at, created_at: n.created_at }; }),
    convByReq: Object.fromEntries([...convByReq.entries()].map(([k, v]) => [k, v.id])),
    activated: act,
  };
}

export type CollabState = Awaited<ReturnType<typeof collabState>>;

/** "X colegi l-au activat deja": the active accounts with a Colaborări profile, shown as at least 20. */
export async function activatedCount(db: D1Database) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM collab_profiles p JOIN users u ON u.id = p.user_id WHERE u.status = 'active'").first<{ n: number }>().catch(() => null);
  return Math.max(20, r?.n ?? 0);
}

/** Home page banner for those who have not activated Colaborări: active posts in their county (else everywhere) and the newest one. */
export async function collabLaunch(db: D1Database, me: { id: string; county: string | null }) {
  const w = me.county ? "AND county = ?2" : "";
  const p = me.county ? [me.id, me.county] : [me.id];
  const [n, latest] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM collab_posts WHERE status = 'active' AND user_id <> ?1 ${w}`).bind(...p).first<{ n: number }>(),
    db.prepare(`SELECT kind, title, city, county, budget, created_at FROM collab_posts WHERE status = 'active' AND user_id <> ?1 ${w} ORDER BY created_at DESC LIMIT 1`).bind(...p)
      .first<{ kind: Kind; title: string; city: string; county: string; budget: number | null; created_at: string }>(),
  ]);
  return { count: n?.n ?? 0, county: me.county, latest: latest ?? null, activated: await activatedCount(db) };
}

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
  const emailed = await emailNewPost(db, who.filter((z) => z.email_notif !== 0).slice(0, 500).map((z) => z.user_id), { id, kind, title, city, county, note, due, budget });
  return { id, notified: who.length, emailed };
}

/** Email for a new post: "Un coleg are nevoie de ajutorul tău", with a sign-in link straight to the post (valid 3 days, once). */
async function emailNewPost(db: D1Database, ids: string[], p: { id: string; kind: Kind; title: string; city: string; county: string; note: string; due: string | null; budget: number | null }) {
  if (!ids.length) return 0;
  const { results: us } = await db.prepare(`SELECT id, email, name FROM users WHERE status = 'active' AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids)
    .all<{ id: string; email: string; name: string }>();
  const what = p.kind === "inspectie" ? "o inspecție" : "o lucrare (raport + inspecție)";
  const due = p.due ? p.due.split("-").reverse().join(".") : null;
  const facts = [`${KINDS[p.kind]}`, `${p.city}, ${p.county}`, due ? `termen ${due}` : null, p.budget ? `buget ${p.budget.toLocaleString("ro-RO")} lei` : "onorariu de stabilit"].filter(Boolean).join(" · ");
  const short = p.note.length > 280 ? `${p.note.slice(0, 277).trimEnd()}…` : p.note;
  const list = [];
  for (const u of us) {
    const link = await magicLink(db, u.email, `/colaborari?post=${p.id}`);
    const hi = u.name?.trim() ? `Bună ziua, ${greetName(u.name)}!` : "Bună ziua!";
    list.push({
      to: u.email,
      subject: `Un coleg are nevoie de ajutorul tău: ${p.title}`,
      text: `${hi}\nUn coleg evaluator caută ajutor pentru ${what} în zona ta.\n\n${p.title}\n${facts}\n${short}\n\nIntră în UVALO să vezi anunțul: ${link}\n(Linkul te autentifică direct și este valabil 3 zile.)\n\nEmailurile pentru anunțuri noi le poți opri din Colaborări → Zone de acoperire.`,
      html: layout({
        eyebrow: "Colaborări", title: "Un coleg are nevoie de ajutorul tău",
        body: `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#4A4A4A">${esc(hi)} Un coleg evaluator caută ajutor pentru ${esc(what)} în zona ta.</p>
<div style="border:1px solid #E2D8C4;border-radius:12px;padding:14px 16px;background:#FBF8F2"><b style="font-size:15px">${esc(p.title)}</b>
<div style="margin-top:4px;font-size:12px;color:#9A5F00;font-weight:bold">${esc(facts)}</div>
<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4A4A4A">${esc(short)}</p></div>`,
        button: { label: "Intră în app să vezi anunțul", url: link },
        foot: "Butonul te autentifică direct în UVALO și este valabil 3 zile. Primești acest email pentru că anunțul este în zonele tale de acoperire; emailurile le poți opri din Colaborări → Zone de acoperire.",
      }),
    });
  }
  return sendEmails(list);
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

/** The author changes the post (text, place, type, date, fee). Those who asked for details get an in-app notification. */
export async function editPost(db: D1Database, me: Me, b: Record<string, unknown>) {
  const p = await postOf(db, b.post_id);
  if (!p || p.user_id !== me.id || p.status === "deleted") return fail("Anunțul nu mai există.");
  const kind = String(b.kind) as Kind;
  if (!(kind in KINDS)) return fail("Alege tipul anunțului: inspecție sau raport + inspecție.");
  const note = text(b.note, 2000), city = clean(b.city, 80), county = String(b.county ?? "");
  if (note.length < 10) return fail("Descrie lucrarea în câteva cuvinte (cel puțin 10 caractere).");
  if (!city || !COUNTIES.includes(county)) return fail("Alege localitatea și județul.");
  const prop = PROPS.includes(String(b.prop)) ? String(b.prop) : null;
  const spec = POST_SPECS.includes(String(b.spec)) ? String(b.spec) : p.spec ?? "EPI";
  const due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) ? b.due : null;
  const budget = b.budget === null || b.budget === "" || b.budget === undefined ? null : Number.isFinite(Number(b.budget)) && Number(b.budget) > 0 ? Math.round(Number(b.budget)) : null;
  const title = clean(b.title, 120) || `${prop ?? "Proprietate"}, ${city}`;
  let lat = p.lat, lng = p.lng;
  if (city !== p.city || county !== p.county) { const g = await place(`${city}, județul ${county}`); lat = g?.lat ?? null; lng = g?.lng ?? null; }
  await db.prepare("UPDATE collab_posts SET kind = ?, title = ?, note = ?, city = ?, county = ?, lat = ?, lng = ?, prop = ?, spec = ?, due = ?, budget = ?, updated_at = ? WHERE id = ?")
    .bind(kind, title, note, city, county, lat, lng, prop, spec, due, budget, now(), p.id).run();
  const { results } = await db.prepare("SELECT user_id FROM collab_requests WHERE post_id = ? AND status <> 'retras'").bind(p.id).all<{ user_id: string }>();
  const test = await testFlag(db);
  for (const r of results) await notify(db, r.user_id, "Anunț modificat", `${nameOf(me)} a modificat anunțul „${title}”, la care ai cerut detalii.`, { view: "feed", hl: p.id }, test);
  return { ok: true, notified: results.length };
}

/**
 * The author deletes the post: it leaves the feed and "Postările mele" (kept as status 'deleted', with its conversations,
 * which show "Anunț șters"). Those who asked for details get an in-app notification.
 */
export async function deletePost(db: D1Database, me: Me, b: Record<string, unknown>) {
  const p = await postOf(db, b.post_id);
  if (!p || p.user_id !== me.id || p.status === "deleted") return fail("Anunțul nu mai există.");
  await db.prepare("UPDATE collab_posts SET status = 'deleted', updated_at = ? WHERE id = ?").bind(now(), p.id).run();
  const { results } = await db.prepare("SELECT r.user_id, (SELECT id FROM collab_convs c WHERE c.request_id = r.id) AS conv_id FROM collab_requests r WHERE r.post_id = ? AND r.status <> 'retras'")
    .bind(p.id).all<{ user_id: string; conv_id: string | null }>();
  const test = await testFlag(db);
  for (const r of results) {
    await notify(db, r.user_id, "Anunț șters", `${nameOf(me)} a șters anunțul „${p.title}”, la care ai cerut detalii.`, r.conv_id ? { view: "chat", conv: r.conv_id } : { view: "feed" }, test);
    if (r.conv_id) await sysMessage(db, r.conv_id, "Autorul a șters anunțul.", test);
  }
  return { ok: true, notified: results.length };
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

/* ---------- launch email ---------- */

/**
 * Those who pressed "Anunță-mă la lansare" for Colaborări and have not activated it: who may receive the launch email now
 * (mode Activ: all of them; Test: only the test group and the UVALO administrators) and who already got it.
 */
export async function launchSubscribers(db: D1Database) {
  const s = await collabSettings(db);
  const { results } = await db.prepare(`SELECT u.id, u.email, u.name, u.is_superadmin AS sup, u.anevar_no, MIN(e.at) AS at,
      EXISTS (SELECT 1 FROM collab_profiles p WHERE p.user_id = u.id) AS active,
      (SELECT MAX(x.at) FROM events x WHERE x.user_id = u.id AND x.module = 'colaborari' AND x.action = 'launch_mail') AS mailed
    FROM events e JOIN users u ON u.id = e.user_id
    WHERE e.module = 'home' AND e.action = 'notify' AND e.target = 'colaborari' AND u.status = 'active' GROUP BY u.id ORDER BY at DESC`)
    .all<{ id: string; email: string; name: string; sup: number; anevar_no: string | null; at: string; active: number; mailed: string | null }>();
  // only valuers (ANEVAR card) or UVALO administrators may use Colaborări
  return results.map((r) => ({ ...r, allowed: (!!r.sup || !!r.anevar_no?.trim()) && (s.mode === "on" || (s.mode === "test" && (s.users.includes(r.id) || !!r.sup))) }));
}

/** The launch email ("Colaborările sunt aici"), with a sign-in link straight to Colaborări, to the subscribers who may use it now. */
export async function sendLaunchEmails(db: D1Database) {
  const list = (await launchSubscribers(db)).filter((r) => r.allowed && !r.active && !r.mailed);
  if (!list.length) return { sent: 0 };
  const n = await activatedCount(db);
  const base = await origin();
  const mails = [];
  for (const u of list) {
    const link = await magicLink(db, u.email, "/colaborari", 7);
    const hi = u.name?.trim() ? `Bună ziua, ${greetName(u.name)}!` : "Bună ziua!";
    mails.push({
      to: u.email,
      subject: "Colaborările sunt aici: găsește un coleg pentru inspecție în câteva minute",
      text: `${hi}\nAi cerut să te anunțăm: Colaborările s-au lansat în UVALO.\nPublici o inspecție sau un raport + inspecție, colegii din zonă primesc notificare și îți cer detalii; alegi pe cine vrei și vorbiți în chat. Sau preiei tu lucrări din zonele în care lucrezi.\n${n} colegi l-au activat deja.\n\nActivează Colaborările: ${link}\n(Linkul te autentifică direct și este valabil 7 zile.)`,
      html: launchHtml({ hi, n, link, img: `${base}/email/colaborari-lansare.png` }),
    });
  }
  const sent = await sendEmails(mails);
  if (sent) await db.batch(list.slice(0, sent).map((u) => db.prepare("INSERT INTO events (user_id, module, action) VALUES (?, 'colaborari', 'launch_mail')").bind(u.id)));
  return { sent };
}

function launchHtml({ hi, n, link, img }: { hi: string; n: number; link: string; img: string }) {
  const feat = (t: string, d: string) => `<tr><td style="padding:0 0 12px;vertical-align:top;width:30px"><div style="width:22px;height:22px;border-radius:11px;background:#141414;color:#E0AD4F;font-size:12px;font-weight:bold;text-align:center;line-height:22px">✓</div></td>
<td style="padding:0 0 12px;font-size:14px;line-height:1.55;color:#4A4A4A"><b style="color:#141414">${esc(t)}</b><br>${esc(d)}</td></tr>`;
  return `<!DOCTYPE html><html lang="ro"><body style="margin:0;padding:0;background:#F2ECE0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2ECE0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;font-family:Verdana,Geneva,sans-serif;color:#141414">
<tr><td style="background:#141414;padding:18px 28px"><span style="color:#fff;font-size:15px;font-weight:bold;letter-spacing:2px">UVA<span style="color:#E0AD4F">LO</span></span>
<span style="float:right;background:#E0AD4F;color:#141414;font-size:10px;font-weight:bold;letter-spacing:1px;padding:5px 10px;border-radius:999px">NOU ÎN UVALO</span></td></tr>
<tr><td style="background:#141414"><a href="${esc(link)}"><img src="${esc(img)}" width="600" alt="Colaborări în UVALO: un anunț de inspecție din zona ta și o conversație între doi evaluatori" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:30px 32px 8px">
<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#9A5F00;text-transform:uppercase">Ai cerut să te anunțăm · Colaborări</p>
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25">Colaborările sunt aici.<br><span style="color:#B07A12">Găsești un coleg pentru inspecție în câteva minute.</span></h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#4A4A4A">${esc(hi)} Publici o lucrare, colegii din zonă primesc notificare și îți cer detalii. Alegi pe cine vrei și vorbiți în chat. Sau preiei tu inspecții și rapoarte de la colegi, în zonele în care lucrezi.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
${feat("Lucrări din zona ta", "Alegi raza în jurul adresei sau județe întregi; primești anunțurile noi în aplicație și pe email.")}
${feat("Profil verificat", "Specializările vin direct din Tabloul ANEVAR.")}
${feat("Discuți în aplicație", "Datele de contact apar doar după ce începe conversația.")}
</table>
<p style="margin:10px 0 26px"><a href="${esc(link)}" style="display:inline-block;background:#F2A93B;color:#111111;font-weight:bold;text-decoration:none;padding:15px 26px;border-radius:12px;font-size:15px">Activează Colaborările →</a>
<span style="display:inline-block;margin-left:12px;font-size:13px;color:#6B6B6B"><b style="color:#141414">${n}</b> colegi l-au activat deja</span></p>
</td></tr>
<tr><td style="background:#FBF8F2;padding:16px 32px;font-size:12px;line-height:1.6;color:#6B6B6B">Primești acest email pentru că ai apăsat „Anunță-mă la lansare” în UVALO. Butonul te autentifică direct și este valabil 7 zile.</td></tr>
</table></td></tr></table></body></html>`;
}
