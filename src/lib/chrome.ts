// UVALO pentru Chrome — the browser extension for capturing property listings as comparables (extensions/chrome).
// Downloaded from /chrome (public/chrome/uvalo-chrome.zip, made with `npm run chrome:zip`), installed with
// "Load unpacked"; it signs in with the UVALO session cookie and checks /api/chrome/status (module "chrome").

/** The extension's versions, newest first; the first must match "version" in extensions/chrome/manifest.json. */
export const CHROME_VERSIONS: { v: string; date: string; notes: string[] }[] = [
  { v: "2.0.1", date: "12 oct. 2026", notes: [
    "Contactul din extensie este acum office@uvalo.ro.",
  ] },
  { v: "2.0.0", date: "11 oct. 2026", notes: [
    "Extensia devine UVALO pentru Chrome: aspect UVALO, conectare cu contul UVALO, acces după abonament.",
    "Folosirea (capturi, exporturi) apare în statisticile UVALO; capturile rămân doar în Chrome.",
    "Panoul anunță când apare o versiune nouă.",
    "Buton nou „Trimite în Word”: comparabilele capturate ajung în Word (tab-ul UVALO → Instrumente → Comparabile din Chrome), unde le inserezi la cursor.",
  ] },
  { v: "1.2.1", date: "iul. 2026", notes: [
    "Prima versiune: capturi pe pagini A4, harta localizării, datele de contact, export Word și PDF.",
  ] },
];
export const CHROME_VERSION = CHROME_VERSIONS[0].v;

/* ---------- „Trimite în Word”: capturile trimise din extensie, preluate în add-in-ul Word ---------- */

export const BATCH_DAYS = 7;
/** D1 keeps a value of at most 2 MB; the extension recompresses bigger images before sending. */
export const MAX_SLICE_BYTES = 1_900_000;

export type BatchItem = { id: string; label: string; title: string; url: string; capturedAt: number | null; slices: number };
export type BatchGroup = { name: string; items: BatchItem[] };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
/** The groups and items sent by the extension, checked and trimmed (at most 60 items, 20 images each). */
export function cleanGroups(v: unknown): BatchGroup[] {
  if (!Array.isArray(v)) return [];
  let n = 0;
  const out: BatchGroup[] = [];
  for (const g of v.slice(0, 30)) {
    if (!g || typeof g !== "object") continue;
    const items: BatchItem[] = [];
    for (const it of (Array.isArray((g as { items?: unknown }).items) ? (g as { items: unknown[] }).items : [])) {
      if (!it || typeof it !== "object" || n >= 60) continue;
      const o = it as Record<string, unknown>;
      const id = s(o.id, 40).replace(/[^\w-]/g, "");
      const url = s(o.url, 2000);
      const slices = Math.max(0, Math.min(20, Math.floor(Number(o.slices) || 0)));
      if (!id || !/^https?:\/\//i.test(url) || !slices) continue;
      items.push({ id, label: s(o.label, 120), title: s(o.title, 300), url, capturedAt: Number(o.capturedAt) || null, slices });
      n++;
    }
    if (items.length) out.push({ name: s((g as { name?: unknown }).name, 120) || "Comparabile", items });
  }
  return out;
}

/** Removes the batches older than BATCH_DAYS (everyone) and, when given, all the batches of one person. */
export async function dropBatches(db: D1Database, userId?: string) {
  const old = new Date(Date.now() - BATCH_DAYS * 864e5).toISOString();
  const ids = (await db.prepare(`SELECT id FROM chrome_batches WHERE created_at < ?${userId ? " OR user_id = ?" : ""}`)
    .bind(...(userId ? [old, userId] : [old])).all<{ id: string }>()).results.map((r) => r.id);
  for (const id of ids) {
    await db.batch([db.prepare("DELETE FROM chrome_slices WHERE batch_id = ?").bind(id), db.prepare("DELETE FROM chrome_batches WHERE id = ?").bind(id)]);
  }
}

/** Access for the capture API: the extension sends (module "chrome"), the Word add-in receives (module "word"). */
export async function captureAccess(module: "chrome" | "word"): Promise<{ db: D1Database; userId: string; c: import("./access").Ctx } | { res: Response }> {
  const { locatorAccess } = await import("./locator");
  const a = await locatorAccess(module);
  if ("status" in a) {
    const error = a.status === 401 ? "Conectează-te cu contul UVALO."
      : "maintenance" in a && a.maintenance ? "Platforma UVALO este în mentenanță. Revenim în curând."
      : a.c?.block ?? (module === "chrome" ? "Planul firmei tale nu include UVALO pentru Chrome." : "Planul firmei tale nu include UVALO pentru Word.");
    return { res: Response.json({ ok: false, error }, { status: a.status }) };
  }
  return { db: a.db, userId: a.c.user.id, c: a.c };
}
