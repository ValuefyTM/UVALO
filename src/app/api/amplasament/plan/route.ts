import Anthropic from "@anthropic-ai/sdk";
import { api, err } from "@/lib/api";
import { track } from "@/lib/track";

// Site analysis (/amplasament) without a cadastral plan in the locator: the valuer uploads the "plan de amplasament și
// delimitare" (PDF or photo) and Claude reads it into data: cadastral number, areas, the Stereo 70 coordinate inventory,
// the buildings, the neighbours, the address. The page rebuilds the parcel from the coordinates and checks the area
// against the one written on the plan. Nothing is stored: the file goes to the model and back.

const MODEL = "claude-opus-5-5";
const PER_DAY = 30;
const MAX = 15 * 1024 * 1024;
const TYPES: Record<string, "application/pdf" | "image/jpeg" | "image/png" | "image/webp"> = {
  "application/pdf": "application/pdf", "image/jpeg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp",
};

const str = { anyOf: [{ type: "string" }, { type: "null" }] };
const num = { anyOf: [{ type: "number" }, { type: "null" }] };
const point = { type: "object", additionalProperties: false, required: ["nr", "x", "y"], properties: { nr: { type: "string" }, x: { type: "number" }, y: { type: "number" } } };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tip_document", "nr_cadastral", "nr_carte_funciara", "uat", "judet", "adresa", "suprafata_masurata_mp", "suprafata_din_acte_mp",
    "categorie_folosinta", "intravilan", "puncte", "constructii", "vecini", "observatii"],
  properties: {
    tip_document: { type: "string", description: "ce fel de document este, de ex. „plan de amplasament și delimitare a imobilului”" },
    nr_cadastral: str, nr_carte_funciara: str,
    uat: { ...str, description: "unitatea administrativ-teritorială (comuna / orașul / municipiul)" },
    judet: str,
    adresa: { ...str, description: "adresa imobilului așa cum e scrisă pe plan" },
    suprafata_masurata_mp: { ...num, description: "suprafața măsurată a imobilului (terenului), în mp" },
    suprafata_din_acte_mp: { ...num, description: "suprafața din acte, dacă e scrisă separat, în mp" },
    categorie_folosinta: { ...str, description: "de ex. curți construcții, arabil" },
    intravilan: { anyOf: [{ type: "boolean" }, { type: "null" }] },
    puncte: { type: "array", description: "inventarul de coordonate al TERENULUI (parcelei), în ordinea din tabel, Stereo 70: x = nord, y = est, în metri cu zecimale", items: point },
    constructii: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["cod", "destinatie", "suprafata_la_sol_mp", "puncte"],
        properties: { cod: { type: "string", description: "de ex. C1" }, destinatie: str, suprafata_la_sol_mp: num, puncte: { type: "array", items: point } },
      },
    },
    vecini: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["latura", "descriere"], properties: { latura: { type: "string", description: "direcția sau punctele laturii, de ex. „N” sau „1-2”" }, descriere: { type: "string" } } },
    },
    observatii: { ...str, description: "ce nu se citește clar sau orice neconcordanță din document" },
  },
};

const SYSTEM = `Citești documente cadastrale din România (în special „plan de amplasament și delimitare a imobilului”, întocmit pentru OCPI / ANCPI) și extragi datele exact cum sunt scrise.
- Nu inventa nimic. Ce lipsește sau nu se citește sigur este null (sau listă goală), iar nesiguranța o explici în „observatii”.
- Inventarul de coordonate: copiază toate punctele terenului, cu toate zecimalele, în ordinea din tabel. În sistemul Stereo 70, X este coordonata nord și Y coordonata est. Punctele construcțiilor nu intră la teren; pune-le la construcția respectivă, dacă sunt în document.
- Suprafețele în metri pătrați, ca numere (fără separatori de mii).
- Dacă documentul nu este un plan cadastral, spune ce este în „tip_document” și lasă restul gol.`;

export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  if (!a.c.super && !a.c.modules.includes("amplasament")) return err("Abonamentul firmei tale nu include analiza amplasamentului.", 403);
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return err("Citirea cu AI nu este configurată încă (lipsește ANTHROPIC_API_KEY).", 503);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return err("Alege fișierul cu planul de amplasament.");
  const type = TYPES[file.type];
  if (!type) return err("Planul trebuie să fie PDF sau imagine (JPG, PNG).");
  if (file.size > MAX) return err("Fișierul are peste 15 MB. Trimite doar pagina cu planul.");

  if (!a.c.super) {
    const used = await a.db.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = ? AND module = 'amplasament' AND action = 'ai_plan' AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')")
      .bind(a.c.user.id).first<{ n: number }>();
    if ((used?.n ?? 0) >= PER_DAY) return err(`Ai citit ${PER_DAY} de planuri în ultimele 24 de ore. Încearcă din nou mai târziu.`, 429);
  }

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const doc: Anthropic.Beta.BetaContentBlockParam = type === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: type, data } }
    : { type: "image", source: { type: "base64", media_type: type, data } };

  const client = new Anthropic({ apiKey: key });
  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: [doc, { type: "text", text: "Extrage datele imobilului din acest document." }] }],
    });
  } catch (e) {
    console.error("[amplasament/plan]", e);
    if (e instanceof Anthropic.BadRequestError) return err("Documentul nu a putut fi citit (fișier prea mare sau deteriorat). Încearcă o poză clară sau un PDF cu o singură pagină.", 422);
    if (e instanceof Anthropic.RateLimitError) return err("Serviciul AI este ocupat. Încearcă din nou peste un minut.", 429);
    if (e instanceof Anthropic.AuthenticationError) return err("Cheia ANTHROPIC_API_KEY nu este validă.", 503);
    return err("Serviciul AI nu a răspuns. Încearcă din nou.", 502);
  }
  if (msg.stop_reason === "refusal") return err("Documentul nu a putut fi citit.", 422);
  let out: Record<string, unknown>;
  try {
    out = JSON.parse(msg.content.map((c) => (c.type === "text" ? c.text : "")).join(""));
  } catch {
    return err("Răspunsul AI nu a putut fi citit. Încearcă din nou.", 502);
  }
  await track(a.db, a.c, "amplasament", "ai_plan", typeof out.nr_cadastral === "string" ? out.nr_cadastral : null,
    { type, kb: Math.round(file.size / 1024), pts: Array.isArray(out.puncte) ? out.puncte.length : 0, in: msg.usage.input_tokens, out: msg.usage.output_tokens });
  return Response.json(out);
}
