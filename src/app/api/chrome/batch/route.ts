import { track } from "@/lib/track";
import { captureAccess, cleanGroups, dropBatches } from "@/lib/chrome";

// POST /api/chrome/batch — the extension starts a "Trimite în Word": the list (groups → items); the images follow one
//   by one (PUT …/[id]/[item]/[idx]) and then POST …/[id]/done. A new send replaces the person's previous one.
// GET  /api/chrome/batch — the Word add-in: the last complete send of the signed-in person.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = await captureAccess("chrome");
  if ("res" in a) return a.res;
  const b = (await req.json().catch(() => ({}))) as { groups?: unknown };
  const groups = cleanGroups(b.groups);
  if (!groups.length) return Response.json({ ok: false, error: "Nu e nicio comparabilă capturată de trimis." }, { status: 400 });
  await dropBatches(a.db, a.userId);
  const id = crypto.randomUUID();
  const slices = groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.slices, 0), 0);
  await a.db.prepare("INSERT INTO chrome_batches (id, user_id, data, slices) VALUES (?, ?, ?, ?)").bind(id, a.userId, JSON.stringify(groups), slices).run();
  return Response.json({ ok: true, id, groups });
}

export async function GET() {
  const a = await captureAccess("word");
  if ("res" in a) return a.res;
  await dropBatches(a.db);
  const row = await a.db.prepare("SELECT id, data, slices, created_at FROM chrome_batches WHERE user_id = ? AND done = 1 ORDER BY created_at DESC LIMIT 1")
    .bind(a.userId).first<{ id: string; data: string; slices: number; created_at: string }>();
  if (!row) return Response.json({ ok: true, batch: null }, { headers: { "Cache-Control": "no-store" } });
  await track(a.db, a.c, "word", "chrome_open", row.id);
  return Response.json({ ok: true, batch: { id: row.id, groups: JSON.parse(row.data), slices: row.slices, created_at: row.created_at } }, { headers: { "Cache-Control": "no-store" } });
}
