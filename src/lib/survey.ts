// The feedback questionnaire (5 steps, see the canvas "UVALO — Chestionar de feedback"): shown once, mandatory, at the next
// sign-in (web or phone) to the people with more than N actions in `events`. Settings in app_settings "survey"; answers in
// survey_answers (one row per survey id and person, saved after every step).
import type { Ctx } from "./access";
import { now } from "./db";
import { esc, layout, sendEmail } from "./email";
import { origin } from "./site";
import { DEFAULT_WANTS, SURVEY_LABELS, SURVEY_STEPS, SURVEY_TOOLS, type SurveySettings, type SurveyState } from "./survey-shared";
export * from "./survey-shared";

const cache: { at: number; v: SurveySettings | null } = { at: 0, v: null };

export async function surveySettings(db: D1Database): Promise<SurveySettings> {
  if (cache.v && Date.now() - cache.at < 5000) return cache.v;
  let d: Partial<SurveySettings> = {};
  try {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = 'survey'").first<{ value: string }>();
    if (row) d = JSON.parse(row.value);
  } catch {}
  const v: SurveySettings = {
    id: typeof d.id === "string" && d.id ? d.id : "2026-11",
    on: !!d.on,
    min_actions: Number.isFinite(d.min_actions) ? Math.max(0, Math.floor(d.min_actions!)) : 30,
    stop_n: Number.isFinite(d.stop_n) ? Math.max(0, Math.floor(d.stop_n!)) : 0,
    stop_at: typeof d.stop_at === "string" ? d.stop_at.slice(0, 10) : "",
    wants: Array.isArray(d.wants) && d.wants.length ? d.wants.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 12) : DEFAULT_WANTS,
    started_at: typeof d.started_at === "string" ? d.started_at : "",
  };
  cache.v = v; cache.at = Date.now();
  return v;
}

export async function setSurveySettings(db: D1Database, actor: string, v: SurveySettings) {
  await db.prepare(`INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('survey', ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(JSON.stringify(v), now(), actor).run();
  cache.v = v; cache.at = Date.now();
}

/** The questionnaire this person has to answer now, or null (off, not eligible, already done, stopped). */
export async function surveyFor(db: D1Database, c: Ctx): Promise<SurveyState | null> {
  if (c.super || c.viewAs) return null;
  const s = await surveySettings(db);
  if (!s.on) return null;
  if (s.stop_at && new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" }) > s.stop_at) return null;
  const row = await db.prepare("SELECT step, answers, done_at FROM survey_answers WHERE survey_id = ? AND user_id = ?").bind(s.id, c.user.id)
    .first<{ step: number; answers: string; done_at: string | null }>().catch(() => null);
  if (row?.done_at) return null;
  if (!row) {
    // not started yet: eligible only from min_actions, and while the questionnaire has not reached its quota
    const n = (await db.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = ?").bind(c.user.id).first<{ n: number }>())?.n ?? 0;
    if (n < s.min_actions) return null;
    if (s.stop_n) {
      const d = (await db.prepare("SELECT COUNT(*) AS n FROM survey_answers WHERE survey_id = ? AND done_at IS NOT NULL").bind(s.id).first<{ n: number }>())?.n ?? 0;
      if (d >= s.stop_n) return null;
    }
    await db.prepare("INSERT OR IGNORE INTO survey_answers (survey_id, user_id, org_id, actions) VALUES (?, ?, ?, ?)").bind(s.id, c.user.id, c.org?.id ?? null, n).run();
  }
  const { results: used } = await db.prepare("SELECT module, COUNT(*) AS n, MAX(at) AS last FROM events WHERE user_id = ? GROUP BY module").bind(c.user.id)
    .all<{ module: string; n: number; last: string }>();
  let answers: Record<string, unknown> = {};
  try { answers = row ? JSON.parse(row.answers) : {}; } catch {}
  return {
    id: s.id, step: row?.step ?? 0, answers, wants: s.wants, name: (c.user.name || "").split(/\s+/).find((w) => /^[A-ZĂÂÎȘȚ][a-zăâîșț]/.test(w)) ?? "", phone: c.user.phone ?? "",
    tools: SURVEY_TOOLS.map((t) => { const u = used.find((x) => x.module === t.key); return { ...t, n: u?.n ?? 0, last: u?.last ?? null }; }),
  };
}

const KEYS = ["nps", "why", "tools", "wants", "wants_other", "problems", "problems_text", "freq", "device", "back", "price", "model", "extra", "call", "phone"];

/** Save a step (1–5); step 5 completes the questionnaire and tells the UVALO administrators. */
export async function saveSurvey(db: D1Database, c: Ctx, step: number, answers: Record<string, unknown>): Promise<{ done: boolean } | { error: string }> {
  const s = await surveySettings(db);
  const row = await db.prepare("SELECT id, answers, done_at FROM survey_answers WHERE survey_id = ? AND user_id = ?").bind(s.id, c.user.id)
    .first<{ id: number; answers: string; done_at: string | null }>();
  if (!row) return { error: "Chestionarul nu este deschis pentru contul tău." };
  if (row.done_at) return { done: true };
  if (!Number.isInteger(step) || step < 1 || step > SURVEY_STEPS) return { error: "Pas invalid." };
  let prev: Record<string, unknown> = {};
  try { prev = JSON.parse(row.answers); } catch {}
  const clean: Record<string, unknown> = { ...prev };
  for (const k of KEYS) if (k in answers) clean[k] = sanitize(answers[k]);
  if (step === 1 && !(Number.isInteger(clean.nps) && (clean.nps as number) >= 0 && (clean.nps as number) <= 10)) return { error: "Alege o notă de la 0 la 10." };
  const done = step === SURVEY_STEPS;
  await db.prepare("UPDATE survey_answers SET answers = ?, step = ?, updated_at = ?, done_at = COALESCE(done_at, ?) WHERE id = ?")
    .bind(JSON.stringify(clean).slice(0, 20000), step, now(), done ? now() : null, row.id).run();
  if (done) await notifyAdmins(db, c, clean).catch(() => {});
  return { done };
}

function sanitize(v: unknown): unknown {
  if (typeof v === "string") return v.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => (typeof x === "string" ? x.slice(0, 200) : typeof x === "number" ? x : null)).filter((x) => x !== null);
  if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v).slice(0, 30)) o[k.slice(0, 40)] = typeof x === "string" ? x.slice(0, 200) : typeof x === "number" ? x : null; return o; }
  return null;
}

const L = SURVEY_LABELS;
const lab = (m: Record<string, string>, k: unknown) => (typeof k === "string" && k in m ? m[k] : "—");

/** The questionnaire as lines of text (the admin email, the CSV). */
export function surveyLines(a: Record<string, unknown>, wants: string[]): [string, string][] {
  const tools = (a.tools ?? {}) as Record<string, unknown>;
  const w = Array.isArray(a.wants) ? (a.wants as unknown[]).map((i) => (typeof i === "number" ? wants[i] ?? `#${i}` : String(i))) : [];
  const extra = Array.isArray(a.extra) ? (a.extra as unknown[]).map((k) => lab(L.extra, k)) : [];
  return [
    ["Recomandare (0–10)", a.nps === undefined ? "—" : String(a.nps)],
    ["Motivul", String(a.why ?? "") || "—"],
    ["Instrumente", SURVEY_TOOLS.map((t) => `${t.label}: ${tools[t.key] === "none" ? "nefolosit" : typeof tools[t.key] === "number" ? `${tools[t.key]}/5` : "—"}`).join(" · ")],
    ["Ce i-ar fi util", w.length ? w.map((x, i) => `${i + 1}. ${x.split(" · ")[0]}`).join(" · ") : "—"],
    ["Altceva", String(a.wants_other ?? "") || "—"],
    ["Probleme", `${lab(L.problems, a.problems)}${a.problems_text ? ` · ${a.problems_text}` : ""}`],
    ["Frecvență", lab(L.freq, a.freq)], ["Dispozitiv", lab(L.device, a.device)], ["Se întoarce pentru", lab(L.back, a.back)],
    ["Preț pe lună", lab(L.price, a.price)], ["Model", lab(L.model, a.model)], ["Ar plăti separat", extra.length ? extra.join(", ") : "—"],
    ["Vrea să fie sunat", a.call === "yes" ? `DA · ${a.phone || "fără telefon"}` : "nu acum"],
  ];
}

async function notifyAdmins(db: D1Database, c: Ctx, a: Record<string, unknown>) {
  const s = await surveySettings(db);
  const who = c.user.name || c.user.email, base = await origin();
  const lines = surveyLines(a, s.wants);
  const { results: admins } = await db.prepare("SELECT email FROM users WHERE is_superadmin = 1 AND status = 'active'").all<{ email: string }>();
  const html = lines.map(([k, v]) => `<tr><td style="padding:6px 10px 6px 0;font-size:12px;color:#6B6B6B;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-size:13px;line-height:1.5;color:#141414">${esc(v)}</td></tr>`).join("");
  for (const x of admins) {
    await sendEmail({
      to: x.email,
      subject: `Chestionar completat · ${who} · nota ${a.nps ?? "—"}${a.call === "yes" ? " · vrea să fie sunat" : ""}`,
      text: `${who} (${c.user.email}${c.org ? `, ${c.org.name}` : ""}) a completat chestionarul ${s.id}:\n\n${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nToate răspunsurile: ${base}/admin/feedback/chestionar`,
      html: layout({
        eyebrow: "UVALO · Chestionar", title: `${who} a completat chestionarul`,
        body: `<p style="margin:0 0 10px;font-size:13px;color:#6B6B6B">${esc(c.user.email)}${c.org ? ` · ${esc(c.org.name)}` : ""}</p><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${html}</table>`,
        button: { label: "Vezi toate răspunsurile →", url: `${base}/admin/feedback/chestionar` },
        foot: "Primești acest email ca administrator UVALO.",
      }),
    }).catch(() => false);
  }
}

export type SurveyRow = { id: number; user_id: string; who: string; email: string; org: string | null; actions: number; step: number; done_at: string | null; created_at: string; updated_at: string; answers: Record<string, unknown> };

/** Admin → Feedback → Chestionar: every answer of the active questionnaire (or of `id`). */
export async function surveyRows(db: D1Database, id: string): Promise<SurveyRow[]> {
  const { results } = await db.prepare(`SELECT s.id, s.user_id, COALESCE(NULLIF(u.name, ''), u.email) AS who, u.email, o.name AS org, s.actions, s.step, s.done_at, s.created_at, s.updated_at, s.answers
    FROM survey_answers s JOIN users u ON u.id = s.user_id LEFT JOIN orgs o ON o.id = s.org_id WHERE s.survey_id = ? ORDER BY s.updated_at DESC`).bind(id)
    .all<Omit<SurveyRow, "answers"> & { answers: string }>();
  return results.map((r) => { let a: Record<string, unknown> = {}; try { a = JSON.parse(r.answers); } catch {} return { ...r, answers: a }; });
}

/** The figures of the admin page, from the completed answers. */
export function surveyStats(rows: SurveyRow[], wants: string[]) {
  const done = rows.filter((r) => r.done_at);
  const nps = done.map((r) => r.answers.nps).filter((n): n is number => typeof n === "number");
  const prom = nps.filter((n) => n >= 9).length, det = nps.filter((n) => n <= 6).length;
  const count = (key: string, labels: Record<string, string>) => Object.keys(labels).map((k) => ({ k, label: labels[k], n: done.filter((r) => r.answers[key] === k).length }));
  const countArr = (key: string, labels: Record<string, string>) => Object.keys(labels).map((k) => ({ k, label: labels[k], n: done.filter((r) => Array.isArray(r.answers[key]) && (r.answers[key] as unknown[]).includes(k)).length }));
  const tools = SURVEY_TOOLS.map((t) => {
    const vals = done.map((r) => ((r.answers.tools ?? {}) as Record<string, unknown>)[t.key]).filter((v): v is number => typeof v === "number");
    return { ...t, n: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
  const wantsW = wants.map((w, i) => ({ label: w.split(" · ")[0], pts: done.reduce((acc, r) => { const a = Array.isArray(r.answers.wants) ? (r.answers.wants as unknown[]).indexOf(i) : -1; return acc + (a === 0 ? 3 : a === 1 ? 2 : a === 2 ? 1 : 0); }, 0), n: done.filter((r) => Array.isArray(r.answers.wants) && (r.answers.wants as unknown[]).includes(i)).length }))
    .sort((a, b) => b.pts - a.pts);
  const other = done.map((r) => String(r.answers.wants_other ?? "").trim()).filter(Boolean);
  const rated = tools.filter((t) => t.avg !== null);
  return {
    n: rows.length, done: done.length, partial: rows.filter((r) => !r.done_at && r.step > 0).length, opened: rows.filter((r) => !r.done_at && r.step === 0).length,
    nps: nps.length ? Math.round(((prom - det) / nps.length) * 100) : null, prom: nps.length ? Math.round((prom / nps.length) * 100) : 0, det: nps.length ? Math.round((det / nps.length) * 100) : 0,
    avg: rated.length ? rated.reduce((a, t) => a + t.avg!, 0) / rated.length : null,
    calls: done.filter((r) => r.answers.call === "yes").length,
    tools, wants: wantsW, other,
    price: count("price", L.price), model: count("model", L.model), freq: count("freq", L.freq), device: count("device", L.device), problems: count("problems", L.problems), back: count("back", L.back), extra: countArr("extra", L.extra),
  };
}

export function surveyCsv(rows: SurveyRow[], wants: string[]) {
  const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const head = ["Data", "Nume", "Email", "Firmă", "Acțiuni", "Completat", ...surveyLines({}, wants).map(([k]) => k)];
  const body = rows.map((r) => [r.updated_at, r.who, r.email, r.org ?? "", r.actions, r.done_at ? "da" : `pasul ${r.step}`, ...surveyLines(r.answers, wants).map(([, v]) => v)].map(q).join(";"));
  return "﻿" + [head.map(q).join(";"), ...body].join("\n");
}
