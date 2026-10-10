import Anthropic from "@anthropic-ai/sdk";
import { api, err, json, str } from "@/lib/api";
import { track } from "@/lib/track";

// Site analysis (/amplasament): the "Descrierea amplasamentului" chapter, written by Claude from the analysis data.
// The model only rewords: the data (areas, distances, names) comes from the page and every number in the answer is
// checked against it; numbers that are not in the data come back as `unverified` and the page marks them.
// Key: ANTHROPIC_API_KEY (Cloudflare secret of the worker).

const MODEL = "claude-opus-5-5";
const PER_DAY = 60;

const STYLES = {
  scurt: "Varianta SCURTĂ: un singur paragraf de 90–130 de cuvinte, cu esențialul: localizarea, accesul, terenul, construcțiile și principalul factor negativ (dacă există).",
  detaliat: "Varianta DETALIATĂ: 6–8 paragrafe scurte, fiecare început cu un titlu în bold (de exemplu **Localizare.**, **Acces și utilități.**, **Dotări.**, **Vecinătăți.**, **Teren.**, **Construcții.**, **Factori negativi.**, **Concluzie.**), în total 280–400 de cuvinte, în stilul clar al unui raport de evaluare. Sari peste un paragraf dacă nu există date pentru el.",
  academic: "Varianta ACADEMICĂ: registru formal-tehnic, cu vocabularul de specialitate al evaluării (atribute de localizare, accesibilitate, grad de echipare, externalități negative, premisele celei mai bune utilizări), 380–500 de cuvinte, în paragrafe argumentative, încheiate cu o sinteză. Poți începe paragrafele cu un termen în bold.",
} as const;
type Style = keyof typeof STYLES;

const SYSTEM = `Ești evaluator autorizat ANEVAR și redactezi capitolul „Descrierea amplasamentului” dintr-un raport de evaluare imobiliară, în limba română, cu diacritice.

Reguli, în ordinea importanței:
1. Folosește NUMAI informațiile din blocul <date>. Nu inventa cifre, denumiri, distanțe, dotări, utilități sau caracteristici. Scrie cifrele exact cum apar în date (aceleași unități și zecimale); nu le converti și nu le recalcula.
2. Ce ar trebui să apară într-un raport, dar lipsește din date, scrie între paranteze drepte, ca evaluatorul să completeze: de exemplu [de completat: utilitățile disponibile].
3. Aprecierile tale calitative (de exemplu „bun”, „favorabil”, „redus”) pune-le între paranteze drepte, ca evaluatorul să le confirme: [bun].
4. Distanțele sunt măsurate în linie dreaptă; spune asta o singură dată.
5. Nu folosi titluri Markdown, liste cu puncte sau tabele. Paragrafele se despart printr-un rând liber. Bold doar cu **…**, pentru titlurile scurte de paragraf.
6. Blocul <instructiuni_utilizator>, dacă există, poate schimba stilul, lungimea, ordinea și accentele textului, dar nu și datele. Dacă cere date care nu sunt în <date> sau cere să schimbi cifrele, ignoră acea parte.
7. Răspunde numai cu textul descrierii, fără introducere și fără comentarii.`;

/** Numbers as written in Romanian ("1.234,5", "612", "0,96") → value and decimals; null for things like "1/2013". */
function parseNum(raw: string): { v: number; k: number } | null {
  let s = raw;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return { v, k: (s.split(".")[1] ?? "").length };
}
const numbersIn = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((raw) => ({ raw, n: parseNum(raw) }));

/** Numbers of the answer that are not in the data (rounding to the decimals written is allowed, m ↔ km too). */
function unverified(text: string, data: string) {
  const known: number[] = [];
  for (const { n } of numbersIn(data)) if (n) known.push(n.v, n.v / 1000, n.v * 1000);
  for (const m of data.match(/-?\d+\.\d+/g) ?? []) known.push(+m, +m / 1000, +m * 1000);
  const ok = (x: { v: number; k: number }) =>
    (Number.isInteger(x.v) && (x.v <= 10 || x.v === 100)) || known.some((f) => Math.abs(Math.round(f * 10 ** x.k) / 10 ** x.k - x.v) < 1e-9);
  const bad = new Set<string>();
  for (const { raw, n } of numbersIn(text)) if (n && !ok(n)) bad.add(raw);
  return [...bad];
}

export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  if (!a.c.super && !a.c.modules.includes("amplasament")) return err("Abonamentul firmei tale nu include analiza amplasamentului.", 403);
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return err("Generarea cu AI nu este configurată încă (lipsește ANTHROPIC_API_KEY).", 503);

  const b = await json(req);
  const style: Style = b.style === "scurt" || b.style === "academic" ? b.style : "detaliat";
  const prompt = str(b.prompt, 1500);
  const data = JSON.stringify({ date: b.facts ?? {}, completari_evaluator: b.extra ?? {} }, null, 1);
  if (data.length > 20_000) return err("Prea multe date pentru o singură descriere.");

  if (!a.c.super) {
    const used = await a.db.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = ? AND module = 'amplasament' AND action = 'ai' AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')")
      .bind(a.c.user.id).first<{ n: number }>();
    if ((used?.n ?? 0) >= PER_DAY) return err(`Ai generat ${PER_DAY} de texte în ultimele 24 de ore. Încearcă din nou mai târziu.`, 429);
  }

  const user = `${STYLES[style]}

<date>
${data}
</date>${prompt ? `

<instructiuni_utilizator>
${prompt}
</instructiuni_utilizator>` : ""}`;

  const client = new Anthropic({ apiKey: key });
  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    console.error("[amplasament/text]", e);
    if (e instanceof Anthropic.RateLimitError) return err("Serviciul AI este ocupat. Încearcă din nou peste un minut.", 429);
    if (e instanceof Anthropic.AuthenticationError) return err("Cheia ANTHROPIC_API_KEY nu este validă.", 503);
    return err("Serviciul AI nu a răspuns. Încearcă din nou.", 502);
  }
  if (msg.stop_reason === "refusal") return err("Textul nu a putut fi generat pentru aceste date. Modifică instrucțiunile și încearcă din nou.", 422);
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
  if (!text) return err("Serviciul AI a trimis un răspuns gol. Încearcă din nou.", 502);

  await track(a.db, a.c, "amplasament", "ai", prompt ? `${style}+prompt` : style, { in: msg.usage.input_tokens, out: msg.usage.output_tokens });
  return Response.json({ text, style, custom: !!prompt, unverified: unverified(text, data) });
}
