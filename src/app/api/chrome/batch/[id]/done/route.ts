import { track } from "@/lib/track";
import { captureAccess } from "@/lib/chrome";

// POST /api/chrome/batch/[id]/done — every image of the send arrived; the Word add-in can take it.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await captureAccess("chrome");
  if ("res" in a) return a.res;
  const { id } = await params;
  const b = await a.db.prepare("SELECT slices FROM chrome_batches WHERE id = ? AND user_id = ?").bind(id, a.userId).first<{ slices: number }>();
  if (!b) return Response.json({ ok: false, error: "Trimiterea nu mai există. Încearcă din nou." }, { status: 404 });
  const got = await a.db.prepare("SELECT COUNT(*) AS n FROM chrome_slices WHERE batch_id = ?").bind(id).first<{ n: number }>();
  if ((got?.n ?? 0) < b.slices) return Response.json({ ok: false, error: `Au ajuns ${got?.n ?? 0} din ${b.slices} imagini. Încearcă din nou.` }, { status: 409 });
  await a.db.prepare("UPDATE chrome_batches SET done = 1 WHERE id = ?").bind(id).run();
  await track(a.db, a.c, "chrome", "send_word", id, { images: b.slices });
  return Response.json({ ok: true });
}
