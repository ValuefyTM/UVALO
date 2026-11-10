import Anthropic from "@anthropic-ai/sdk";
import { api, err, json, str } from "@/lib/api";
import { track } from "@/lib/track";
import { aiLimitError, prompts } from "@/lib/tools";

// Site analysis (/amplasament): the "Descrierea amplasamentului" chapter, written by Claude from the analysis data.
// The model only rewords: the data (areas, distances, names) comes from the page and every number in the answer is
// checked against it; numbers that are not in the data come back as `unverified` and the page marks them.
// Key: ANTHROPIC_API_KEY (Cloudflare secret of the worker). The prompts and the daily limit are set in
// Admin → Instrumente → Analiza amplasamentului (defaults in src/lib/tools.ts).

const MODEL = "claude-opus-5-5";

type Style = "scurt" | "detaliat" | "academic";

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

  const P = await prompts(a.db);
  const limit = await aiLimitError(a.db, a.c, "text");
  if (limit) return err(limit, 429);

  const user = `${P[style]}

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
      system: P.system,
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
