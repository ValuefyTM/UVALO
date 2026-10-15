import Anthropic from "@anthropic-ai/sdk";
import { api, err } from "@/lib/api";
import { getFiles } from "@/lib/db";
import { track } from "@/lib/track";
import { aiLimitError } from "@/lib/tools";
import { addFile, fileFor, getInspection } from "@/lib/insp";

// "Preia din RLV" (phone app, Finisaje încăperi): Claude reads the floor survey (releveu) into the list of rooms with their areas.
// multipart: id (inspection) and either fileId (a releveu already attached) or file (photographed / chosen on the phone; it is
// also attached to the inspection as its releveu).

const MODEL = "claude-opus-5-5";
const MAX = 15 * 1024 * 1024;
const TYPES: Record<string, "application/pdf" | "image/jpeg" | "image/png" | "image/webp"> = {
  "application/pdf": "application/pdf", "image/jpeg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp",
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["incaperi", "suprafata_utila_mp", "observatii"],
  properties: {
    incaperi: {
      type: "array",
      description: "încăperile din releveu, în ordinea numerotării de pe desen sau din tabel",
      items: {
        type: "object", additionalProperties: false, required: ["nume", "suprafata_mp"],
        properties: {
          nume: { type: "string", description: "denumirea scrisă pe releveu, de ex. „Hol”, „Bucătărie”, „Baie”, „Cameră 1”, „Balcon”" },
          suprafata_mp: { anyOf: [{ type: "number" }, { type: "null" }], description: "suprafața utilă a încăperii, în mp, cum e scrisă" },
        },
      },
    },
    suprafata_utila_mp: { anyOf: [{ type: "number" }, { type: "null" }], description: "suprafața utilă totală, dacă e scrisă" },
    observatii: { anyOf: [{ type: "string" }, { type: "null" }], description: "ce nu se citește clar" },
  },
};
const SYSTEM = `Citești releveul unei locuințe sau al unei clădiri (desen cu încăperile și suprafețele lor, de obicei cu un tabel al încăperilor).
Extrage fiecare încăpere cu denumirea ei și suprafața utilă în mp, exact cum sunt scrise. Include și balcoanele, logiile, terasele și boxele,
cu denumirea lor. Dacă releveul are mai multe niveluri, adaugă nivelul la denumire (de ex. „Dormitor 1 · etaj”). Nu inventa încăperi sau cifre;
ce nu se citește lasă cu suprafața null și spune în observații.`;

export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.modules.includes("inspectii")) return err("Modulul Inspecții nu este încă disponibil.", 403);
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return err("Citirea cu AI nu este configurată încă (lipsește ANTHROPIC_API_KEY).", 503);
  const bucket = await getFiles();
  const fd = await req.formData().catch(() => null);
  const id = typeof fd?.get("id") === "string" ? (fd!.get("id") as string) : "";
  const fileId = typeof fd?.get("fileId") === "string" ? (fd!.get("fileId") as string) : "";
  const up = fd?.get("file");
  if (!id || !(await getInspection(db, c, id))) return err("Inspecția nu există.", 404);

  let type: (typeof TYPES)[string] | undefined, bytes: ArrayBuffer, size: number;
  if (fileId) {
    const f = await fileFor(db, c, fileId);
    if (!f || f.inspection_id !== id || !bucket) return err("Releveul nu a fost găsit.", 404);
    const o = await bucket.get(f.r2_key);
    if (!o) return err("Releveul nu a fost găsit.", 404);
    type = TYPES[o.httpMetadata?.contentType ?? ""];
    bytes = await o.arrayBuffer(); size = bytes.byteLength;
  } else if (up instanceof File) {
    type = TYPES[up.type];
    bytes = await up.arrayBuffer(); size = up.size;
  } else return err("Alege releveul.");
  if (!type) return err("Releveul trebuie să fie PDF sau imagine (JPG, PNG).");
  if (size > MAX) return err("Fișierul are peste 15 MB.");

  const limit = await aiLimitError(db, c, "plan");
  if (limit) return err(limit, 429);

  const data = Buffer.from(bytes).toString("base64");
  const doc: Anthropic.Beta.BetaContentBlockParam = type === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: type, data } }
    : { type: "image", source: { type: "base64", media_type: type, data } };
  const client = new Anthropic({ apiKey: key });
  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: [doc, { type: "text", text: "Extrage încăperile din acest releveu." }] }],
    });
  } catch (e) {
    console.error("[inspectii/rlv]", e);
    if (e instanceof Anthropic.BadRequestError) return err("Releveul nu a putut fi citit. Încearcă o poză clară sau un PDF cu o singură pagină.", 422);
    if (e instanceof Anthropic.RateLimitError) return err("Serviciul AI este ocupat. Încearcă din nou peste un minut.", 429);
    return err("Serviciul AI nu a răspuns. Încearcă din nou.", 502);
  }
  if (msg.stop_reason === "refusal") return err("Releveul nu a putut fi citit.", 422);
  let out: { incaperi: { nume: string; suprafata_mp: number | null }[]; suprafata_utila_mp: number | null; observatii: string | null };
  try {
    out = JSON.parse(msg.content.map((x) => (x.type === "text" ? x.text : "")).join(""));
  } catch {
    return err("Răspunsul AI nu a putut fi citit. Încearcă din nou.", 502);
  }
  const rooms = (out.incaperi ?? []).filter((r) => r.nume?.trim()).map((r) => ({ n: r.nume.trim().slice(0, 60), a: typeof r.suprafata_mp === "number" ? r.suprafata_mp : null }));
  if (!rooms.length) return err("Nu am găsit încăperi pe releveu. Încearcă o poză mai clară.", 422);

  // a releveu photographed on the phone is kept with the inspection's documents
  if (!fileId && up instanceof File && bucket) await addFile(db, bucket, c, id, up, { kind: "releveu", name: up.name || "releveu" }).catch(() => null);
  await track(db, c, "inspectii", "ai_rlv", id || null, { rooms: rooms.length, kb: Math.round(size / 1024), in: msg.usage.input_tokens, out: msg.usage.output_tokens, test: 1 });
  return Response.json({ rooms, total: out.suprafata_utila_mp, note: out.observatii });
}
