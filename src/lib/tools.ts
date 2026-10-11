// Server-only: the tools of the platform as the administration sees them — on/off, daily AI limits, the AI prompts of the
// site analysis (defaults in code, changes in app_settings) and the usage of each tool. A tool turned off disappears for
// everyone but UVALO administrators (super-admins keep using it, to check it before turning it back on).
import { now } from "./db";

export const TOOLS = [
  { key: "localizare", name: "Localizator cadastral", href: "/localizare", desc: "Planurile ANCPI: căutare după număr cadastral, topo, adresă, GPS; exporturi." },
  { key: "amplasament", name: "Analiza amplasamentului", href: "/amplasament", desc: "Fișa amplasamentului și textul pentru raport, generat cu AI." },
  { key: "comparabile", name: "Localizator de comparabile", href: "/comparabile", desc: "Subiectul și comparabilele pe hartă, cu distanțe." },
] as const;
export type ToolKey = (typeof TOOLS)[number]["key"];
export const toolByKey = (k: string) => TOOLS.find((t) => t.key === k) ?? null;

export type ToolSettings = { off: string[]; limits: { ai_text: number; ai_plan: number } };
const DEFAULT: ToolSettings = { off: [], limits: { ai_text: 60, ai_plan: 30 } };

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
  const d = await read<Partial<ToolSettings>>(db, "tools");
  const v: ToolSettings = {
    off: Array.isArray(d?.off) ? d!.off.filter((k) => typeof k === "string") : [],
    limits: { ai_text: Number(d?.limits?.ai_text) > 0 ? Number(d!.limits!.ai_text) : DEFAULT.limits.ai_text, ai_plan: Number(d?.limits?.ai_plan) > 0 ? Number(d!.limits!.ai_plan) : DEFAULT.limits.ai_plan },
  };
  cache = { at: Date.now(), v };
  return v;
}

export async function setToolSettings(db: D1Database, actor: string, change: { key?: string; on?: boolean; limits?: Partial<ToolSettings["limits"]> }) {
  const cur = await toolSettings(db);
  const off = new Set(cur.off);
  if (change.key && typeof change.on === "boolean") (change.on ? off.delete(change.key) : off.add(change.key));
  const lim = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 1 && Number(v) <= 1000 ? Math.round(Number(v)) : d);
  const v: ToolSettings = { off: [...off], limits: { ai_text: lim(change.limits?.ai_text, cur.limits.ai_text), ai_plan: lim(change.limits?.ai_plan, cur.limits.ai_plan) } };
  await write(db, "tools", actor, v);
  cache = { at: Date.now(), v };
  return v;
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
  plan: `Citești documente cadastrale din România (în special „plan de amplasament și delimitare a imobilului”, întocmit pentru OCPI / ANCPI) și extragi datele exact cum sunt scrise.
- Nu inventa nimic. Ce lipsește sau nu se citește sigur este null (sau listă goală), iar nesiguranța o explici în „observatii”.
- Inventarul de coordonate: copiază toate punctele terenului, cu toate zecimalele, în ordinea din tabel. În sistemul Stereo 70, X este coordonata nord și Y coordonata est. Punctele construcțiilor nu intră la teren; pune-le la construcția respectivă, dacă sunt în document.
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
