// Server-only: the tools of the platform as the administration sees them — on/off, daily AI limits, the AI prompts of the
// site analysis (defaults in code, changes in app_settings) and the usage of each tool. A tool turned off disappears for
// everyone but UVALO administrators (super-admins keep using it, to check it before turning it back on).
import { now } from "./db";

export const TOOLS = [
  { key: "localizare", name: "Localizator cadastral", href: "/localizare", desc: "Planurile ANCPI: căutare după număr cadastral, topo, adresă, GPS; exporturi." },
  { key: "amplasament", name: "Analiza amplasamentului", href: "/amplasament", desc: "Fișa amplasamentului și textul pentru raport, generat cu AI." },
  { key: "comparabile", name: "Localizator de comparabile", href: "/comparabile", desc: "Subiectul și comparabilele pe hartă, cu distanțe." },
  { key: "chrome", name: "UVALO pentru Chrome", href: "/chrome", desc: "Extensia Chrome: capturi de anunțuri pe pagini A4 și dosarul comparabilelor în Word/PDF." },
  { key: "word", name: "UVALO pentru Word", href: "/word", desc: "Add-in-ul din Word: Anexă foto și Anexă documente, instalat fără Microsoft Store." },
  { key: "inspectii", name: "Inspecții", href: "/inspectii", desc: "Inspecții pregătite pe web și făcute pe telefon (aplicația UVALO): fișe editabile, fotografii, PDF. În test: doar super-adminii." },
  { key: "colaborari", name: "Colaborări", href: "/colaborari", desc: "Lucrări ocazionale între evaluatori: anunțuri, zone de acoperire, cereri de detalii și mesaje. Moduri: Dezactivat, Test, Activ." },
] as const;
export type ToolKey = (typeof TOOLS)[number]["key"];
export const toolByKey = (k: string) => TOOLS.find((t) => t.key === k) ?? null;
/** Parts of a tool that can be turned off on their own (key "<tool>.<part>" in the same `off` list). */
export const FEATURES = [
  { key: "word.photo", tool: "word", name: "Anexă foto", desc: "Butonul „Anexă foto” din tab-ul UVALO din Word." },
  { key: "word.pdf", tool: "word", name: "Anexă documente", desc: "Butonul „Anexă documente” din tab-ul UVALO din Word." },
  { key: "word.chrome", tool: "word", name: "Comparabile din Chrome", desc: "Preluarea în Word a anunțurilor capturate cu UVALO pentru Chrome („Trimite în Word”)." },
  { key: "word.comps", tool: "word", name: "Comparabile în Word", desc: "Butonul „Comparabile”: localizatorul de comparabile în fereastră mare, cu inserare în raport." },
] as const;

// Limits: per person per 24 hours (ai_text, ai_plan; a person can have an exception), and platform caps per calendar
// day and month for everyone together (total_*; 0 = no cap), so the AI cost stays under control.
export type Limits = { ai_text: number; ai_plan: number; total_text_day: number; total_plan_day: number; total_text_month: number; total_plan_month: number };
export type ToolSettings = { off: string[]; limits: Limits };
const DEFAULT: ToolSettings = { off: [], limits: { ai_text: 60, ai_plan: 30, total_text_day: 0, total_plan_day: 0, total_text_month: 0, total_plan_month: 0 } };

let cache: { at: number; v: ToolSettings } | null = null;

async function read<T>(db: D1Database, key: string): Promise<T | null> {
  try {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{ value: string }>();
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}
async function write(db: D1Database, key: string, actor: string, value: unknown) {
  await db.prepare(`INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(key, JSON.stringify(value), now(), actor).run();
}

/** On/off and limits (a few seconds of cache per worker instance, like maintenance). */
export async function toolSettings(db: D1Database): Promise<ToolSettings> {
  if (cache && Date.now() - cache.at < 5000) return cache.v;
  const d = await read<{ off?: unknown; limits?: Partial<Record<keyof Limits, unknown>> }>(db, "tools");
  const n = (k: keyof Limits, min: number) => (Number.isFinite(Number(d?.limits?.[k])) && Number(d?.limits?.[k]) >= min ? Number(d!.limits![k]) : DEFAULT.limits[k]);
  const v: ToolSettings = {
    off: Array.isArray(d?.off) ? (d!.off as unknown[]).filter((k): k is string => typeof k === "string") : [],
    limits: { ai_text: n("ai_text", 1), ai_plan: n("ai_plan", 1), total_text_day: n("total_text_day", 0), total_plan_day: n("total_plan_day", 0), total_text_month: n("total_text_month", 0), total_plan_month: n("total_plan_month", 0) },
  };
  cache = { at: Date.now(), v };
  return v;
}

export async function setToolSettings(db: D1Database, actor: string, change: { key?: string; on?: boolean; limits?: Partial<Limits> }) {
  const cur = await toolSettings(db);
  const off = new Set(cur.off);
  if (change.key && typeof change.on === "boolean") (change.on ? off.delete(change.key) : off.add(change.key));
  const lim = (k: keyof Limits) => {
    const v = change.limits?.[k], min = k.startsWith("total") ? 0 : 1;
    return v !== undefined && Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= 100000 ? Math.round(Number(v)) : cur.limits[k];
  };
  const v: ToolSettings = { off: [...off], limits: Object.fromEntries((Object.keys(DEFAULT.limits) as (keyof Limits)[]).map((k) => [k, lim(k)])) as Limits };
  await write(db, "tools", actor, v);
  cache = { at: Date.now(), v };
  return v;
}

/* ---------- per-person exceptions to the daily limits ---------- */

export type UserLimit = { ai_text?: number; ai_plan?: number };
export async function userLimits(db: D1Database): Promise<Record<string, UserLimit>> {
  return (await read<Record<string, UserLimit>>(db, "limits:users")) ?? {};
}
/** Sets (or, with both empty, removes) the exception of one person. */
export async function setUserLimit(db: D1Database, actor: string, userId: string, l: { ai_text?: unknown; ai_plan?: unknown }) {
  const all = await userLimits(db);
  const ok = (v: unknown) => (v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100000 ? Math.round(Number(v)) : undefined);
  const e: UserLimit = { ai_text: ok(l.ai_text), ai_plan: ok(l.ai_plan) };
  if (e.ai_text === undefined && e.ai_plan === undefined) delete all[userId];
  else all[userId] = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined));
  await write(db, "limits:users", actor, all);
  return all;
}

/* ---------- checking the limits before an AI call ---------- */

const ISO = (d: Date) => d.toISOString();
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return ISO(d); };
const monthStart = () => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return ISO(d); };

/** How many AI calls of a kind (texts: action "ai", plans: "ai_plan") the whole platform made today and this month. */
export async function aiTotals(db: D1Database) {
  const r = await db.prepare(`SELECT
      SUM(CASE WHEN action = 'ai' AND at >= ?1 THEN 1 ELSE 0 END) AS text_day, SUM(CASE WHEN action = 'ai_plan' AND at >= ?1 THEN 1 ELSE 0 END) AS plan_day,
      SUM(CASE WHEN action = 'ai' THEN 1 ELSE 0 END) AS text_month, SUM(CASE WHEN action = 'ai_plan' THEN 1 ELSE 0 END) AS plan_month
    FROM events WHERE module = 'amplasament' AND action IN ('ai', 'ai_plan') AND at >= ?2`).bind(dayStart(), monthStart())
    .first<{ text_day: number | null; plan_day: number | null; text_month: number | null; plan_month: number | null }>();
  return { text_day: r?.text_day ?? 0, plan_day: r?.plan_day ?? 0, text_month: r?.text_month ?? 0, plan_month: r?.plan_month ?? 0 };
}

/** Null when the person may make one more AI call of this kind; otherwise the message to show. Super-admins: no limit. */
export async function aiLimitError(db: D1Database, c: { super: boolean; user: { id: string } }, kind: "text" | "plan") {
  if (c.super) return null;
  const [{ limits }, users, totals] = await Promise.all([toolSettings(db), userLimits(db), aiTotals(db)]);
  const day = kind === "text" ? limits.total_text_day : limits.total_plan_day, month = kind === "text" ? limits.total_text_month : limits.total_plan_month;
  if (day > 0 && (kind === "text" ? totals.text_day : totals.plan_day) >= day) return "Generarea cu AI este indisponibilă temporar pentru azi. Revine mâine.";
  if (month > 0 && (kind === "text" ? totals.text_month : totals.plan_month) >= month) return "Generarea cu AI este indisponibilă temporar până la începutul lunii viitoare.";
  const own = users[c.user.id]?.[kind === "text" ? "ai_text" : "ai_plan"];
  const per = own ?? (kind === "text" ? limits.ai_text : limits.ai_plan);
  const used = await db.prepare(`SELECT COUNT(*) AS n FROM events WHERE user_id = ? AND module = 'amplasament' AND action = ? AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`)
    .bind(c.user.id, kind === "text" ? "ai" : "ai_plan").first<{ n: number }>();
  if (per === 0) return kind === "text" ? "Contul tău nu are acces la generarea textelor cu AI. Scrie-ne dacă ai nevoie de ea." : "Contul tău nu are acces la citirea planurilor cu AI. Scrie-ne dacă ai nevoie de ea.";
  if ((used?.n ?? 0) >= per) return kind === "text"
    ? `Ai generat ${per} ${per === 1 ? "text" : "de texte"} în ultimele 24 de ore, cât permite contul tău. Încearcă din nou mai târziu.`
    : `Ai citit ${per} ${per === 1 ? "plan" : "de planuri"} în ultimele 24 de ore, cât permite contul tău. Încearcă din nou mai târziu.`;
  return null;
}

/* ---------- the prompts of the site analysis ---------- */

export const PROMPT_DEFAULTS = {
  system: `Ești evaluator autorizat ANEVAR și redactezi capitolul „Descrierea amplasamentului” dintr-un raport de evaluare imobiliară, în limba română, cu diacritice.

Reguli, în ordinea importanței:
1. Folosește NUMAI informațiile din blocul <date>. Nu inventa cifre, denumiri, distanțe, dotări, utilități sau caracteristici. Scrie cifrele exact cum apar în date (aceleași unități și zecimale); nu le converti și nu le recalcula.
2. Ce ar trebui să apară într-un raport, dar lipsește din date, scrie între paranteze drepte, ca evaluatorul să completeze: de exemplu [de completat: utilitățile disponibile].
3. Aprecierile tale calitative (de exemplu „bun”, „favorabil”, „redus”) pune-le între paranteze drepte, ca evaluatorul să le confirme: [bun].
4. Distanțele sunt măsurate în linie dreaptă; spune asta o singură dată.
5. Nu folosi titluri Markdown, liste cu puncte sau tabele. Paragrafele se despart printr-un rând liber. Bold doar cu **…**, pentru titlurile scurte de paragraf.
6. Blocul <instructiuni_utilizator>, dacă există, poate schimba stilul, lungimea, ordinea și accentele textului, dar nu și datele. Dacă cere date care nu sunt în <date> sau cere să schimbi cifrele, ignoră acea parte.
7. Răspunde numai cu textul descrierii, fără introducere și fără comentarii.`,
  scurt: "Varianta SCURTĂ: un singur paragraf de 90–130 de cuvinte, cu esențialul: localizarea, accesul, terenul, construcțiile și principalul factor negativ (dacă există).",
  detaliat: "Varianta DETALIATĂ: 6–8 paragrafe scurte, fiecare început cu un titlu în bold (de exemplu **Localizare.**, **Acces și utilități.**, **Dotări.**, **Vecinătăți.**, **Teren.**, **Construcții.**, **Factori negativi.**, **Concluzie.**), în total 280–400 de cuvinte, în stilul clar al unui raport de evaluare. Sari peste un paragraf dacă nu există date pentru el.",
  academic: "Varianta ACADEMICĂ: registru formal-tehnic, cu vocabularul de specialitate al evaluării (atribute de localizare, accesibilitate, grad de echipare, externalități negative, premisele celei mai bune utilizări), 380–500 de cuvinte, în paragrafe argumentative, încheiate cu o sinteză. Poți începe paragrafele cu un termen în bold.",
  plan: `Citești documente cadastrale din România („plan de amplasament și delimitare a imobilului”, extras de plan cadastral, extras de carte funciară) și extragi datele exact cum sunt scrise.
- Nu inventa nimic. Ce lipsește sau nu se citește sigur este null (sau listă goală), iar nesiguranța o explici în „observatii”.
- Inventarul de coordonate: copiază toate punctele terenului, cu toate zecimalele, în ordinea din tabel. În sistemul Stereo 70, X este coordonata nord și Y coordonata est. Punctele construcțiilor nu intră la teren; pune-le la construcția respectivă, dacă sunt în document.
- În extrasul de carte funciară coordonatele sunt în tabelul „Lungime segmente” (punct început, X / Y, punct sfârșit, X / Y, lungime): ia fiecare punct o singură dată, în ordinea punctelor, cu valorile exact cum apar (primul număr în x, al doilea în y; ordinea nord / est o stabilește aplicația), iar lungimile în „laturi”.
- Fără tabel de coordonate, dar cu caroiaj Stereo 70 desenat (cruci cu valori de tipul 476000 / 210500): sursa_coordonate = „caroiaj” și estimează coordonatele colțurilor terenului din poziția lor față de cruci (X crește spre nord, Y spre est) și din scară; verifică estimarea cu lungimile laturilor scrise pe desen. Copiază și cotele laturilor în „laturi”.
- Parcelele vecine desenate în schiță (cu numărul cadastral scris în ele) intră în „parcele_vecine”: colțurile lor estimate din desen față de punctele terenului, în aceeași convenție x / y ca la „puncte”. Dacă nu se văd, lista rămâne goală.
- Suprafețele în metri pătrați, ca numere (fără separatori de mii).
- Dacă documentul nu este un plan cadastral, spune ce este în „tip_document” și lasă restul gol.`,
};
export type PromptKey = keyof typeof PROMPT_DEFAULTS;
export const PROMPT_LABELS: Record<PromptKey, { name: string; desc: string }> = {
  system: { name: "Instrucțiunile generale (pentru toate textele)", desc: "Rolul și regulile pe care le respectă orice descriere a amplasamentului: doar datele de pe pagină, ce se marchează cu paranteze drepte, formatul." },
  scurt: { name: "Varianta Scurt", desc: "Se adaugă la instrucțiunile generale când utilizatorul alege „Scurt”." },
  detaliat: { name: "Varianta Detaliat", desc: "Se adaugă la instrucțiunile generale pentru „Detaliat” și pentru „Personalizat” (unde se adaugă și promptul utilizatorului)." },
  academic: { name: "Varianta Academic", desc: "Se adaugă la instrucțiunile generale când utilizatorul alege „Academic”." },
  plan: { name: "Citirea planului de amplasament încărcat", desc: "Instrucțiunile pentru extragerea datelor (coordonate, suprafețe, construcții, vecini) din PDF-ul sau poza încărcată." },
};

/** The prompts in use: a change saved from the administration, else the default. */
export async function prompts(db: D1Database): Promise<Record<PromptKey, string> & { changed: PromptKey[] }> {
  const d = (await read<Partial<Record<PromptKey, string>>>(db, "prompts:amplasament")) ?? {};
  const keys = Object.keys(PROMPT_DEFAULTS) as PromptKey[];
  const out = Object.fromEntries(keys.map((k) => [k, typeof d[k] === "string" && d[k]!.trim() ? d[k]! : PROMPT_DEFAULTS[k]])) as Record<PromptKey, string>;
  return { ...out, changed: keys.filter((k) => typeof d[k] === "string" && d[k]!.trim() && d[k] !== PROMPT_DEFAULTS[k]) };
}

/** Saves the changed prompts; an empty text or the default text goes back to the default. */
export async function setPrompts(db: D1Database, actor: string, change: Partial<Record<PromptKey, string>>) {
  const cur = (await read<Partial<Record<PromptKey, string>>>(db, "prompts:amplasament")) ?? {};
  for (const k of Object.keys(PROMPT_DEFAULTS) as PromptKey[]) {
    if (!(k in change)) continue;
    const v = String(change[k] ?? "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
    if (!v || v === PROMPT_DEFAULTS[k]) delete cur[k];
    else cur[k] = v;
  }
  await write(db, "prompts:amplasament", actor, cur);
}

/* ---------- usage of one tool (events of its module) ---------- */

const since = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export async function toolUsage(db: D1Database, module: string, days = 30, targetActions: string[] = ["analysis"]) {
  const from = since(days);
  const [k, byDay, actions, people, targets] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS users, COUNT(DISTINCT org_id) AS orgs,
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE module = ?1 AND at > ?3) AS users7,
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE module = ?1) AS usersAll
      FROM events WHERE module = ?1 AND at > ?2`).bind(module, from, since(7)).first<{ n: number; users: number; orgs: number; users7: number; usersAll: number }>(),
    db.prepare(`SELECT substr(at, 1, 10) AS d, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM events WHERE module = ? AND at > ? GROUP BY d ORDER BY d`)
      .bind(module, from).all<{ d: string; n: number; u: number }>(),
    db.prepare(`SELECT action, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM events WHERE module = ? AND at > ? GROUP BY action ORDER BY n DESC`)
      .bind(module, from).all<{ action: string; n: number; u: number }>(),
    db.prepare(`SELECT e.user_id AS id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, u.anevar_no, o.name AS org, COUNT(*) AS n, MAX(e.at) AS last
      FROM events e JOIN users u ON u.id = e.user_id LEFT JOIN orgs o ON o.id = e.org_id
      WHERE e.module = ? AND e.at > ? GROUP BY e.user_id ORDER BY n DESC LIMIT 25`)
      .bind(module, from).all<{ id: string; name: string; email: string; anevar_no: string | null; org: string | null; n: number; last: string }>(),
    db.prepare(`SELECT target, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM events WHERE module = ? AND at > ? AND target IS NOT NULL
      AND action IN (${targetActions.map(() => "?").join(",") || "''"}) GROUP BY target ORDER BY n DESC LIMIT 15`).bind(module, from, ...targetActions).all<{ target: string; n: number; u: number }>(),
  ]);
  const map = new Map(byDay.results.map((r) => [r.d, r]));
  const daysList = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10);
    return map.get(d) ?? { d, n: 0, u: 0 };
  });
  return { k: k ?? { n: 0, users: 0, orgs: 0, users7: 0, usersAll: 0 }, days: daysList, actions: actions.results, people: people.results, targets: targets.results };
}

/** AI use of the site analysis: texts per variant, plans read, tokens (30 days). */
export async function aiUsage(db: D1Database, days = 30) {
  const { results } = await db.prepare(`SELECT action, target, meta FROM events WHERE module = 'amplasament' AND action IN ('ai', 'ai_plan') AND at > ?`)
    .bind(since(days)).all<{ action: string; target: string | null; meta: string | null }>();
  const byStyle: Record<string, number> = {};
  let texts = 0, plans = 0, tin = 0, tout = 0;
  for (const r of results) {
    let m: { in?: number; out?: number } = {};
    try { m = JSON.parse(r.meta ?? "{}"); } catch {}
    tin += Number(m.in) || 0; tout += Number(m.out) || 0;
    if (r.action === "ai_plan") { plans++; continue; }
    texts++;
    const s = (r.target ?? "detaliat").replace("+prompt", " + prompt propriu");
    byStyle[s] = (byStyle[s] ?? 0) + 1;
  }
  return { texts, plans, tin, tout, byStyle: Object.entries(byStyle).sort((a, b) => b[1] - a[1]) };
}
