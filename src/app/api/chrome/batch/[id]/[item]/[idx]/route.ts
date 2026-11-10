import { captureAccess, MAX_SLICE_BYTES } from "@/lib/chrome";

// PUT /api/chrome/batch/[id]/[item]/[idx]?w=&h= — one captured image (JPEG) of a send, from the extension.
// GET — the same image, for the Word add-in of the same person.
type P = { params: Promise<{ id: string; item: string; idx: string }> };

export async function PUT(req: Request, { params }: P) {
  const a = await captureAccess("chrome");
  if ("res" in a) return a.res;
  const { id, item, idx } = await params;
  const own = await a.db.prepare("SELECT data FROM chrome_batches WHERE id = ? AND user_id = ? AND done = 0").bind(id, a.userId).first<{ data: string }>();
  if (!own) return Response.json({ ok: false, error: "Trimiterea nu mai există." }, { status: 404 });
  const groups = JSON.parse(own.data) as { items: { id: string; slices: number }[] }[];
  const it = groups.flatMap((g) => g.items).find((x) => x.id === item);
  const i = Number(idx);
  if (!it || !Number.isInteger(i) || i < 0 || i >= it.slices) return Response.json({ ok: false, error: "Imagine necunoscută." }, { status: 400 });
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_SLICE_BYTES) return Response.json({ ok: false, error: "Imaginea e prea mare." }, { status: 413 });
  const mime = (req.headers.get("content-type") ?? "").startsWith("image/png") ? "image/png" : "image/jpeg";
  const u = new URL(req.url);
  const dim = (k: string) => Math.max(0, Math.min(20000, Math.floor(Number(u.searchParams.get(k)) || 0))) || null;
  await a.db.prepare("INSERT OR REPLACE INTO chrome_slices (batch_id, item_id, idx, mime, w, h, data) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, item, i, mime, dim("w"), dim("h"), buf).run();
  return Response.json({ ok: true });
}

export async function GET(_req: Request, { params }: P) {
  const a = await captureAccess("word");
  if ("res" in a) return a.res;
  const { id, item, idx } = await params;
  const row = await a.db.prepare("SELECT s.mime, s.data FROM chrome_slices s JOIN chrome_batches b ON b.id = s.batch_id WHERE s.batch_id = ? AND s.item_id = ? AND s.idx = ? AND b.user_id = ?")
    .bind(id, item, Number(idx), a.userId).first<{ mime: string; data: ArrayBuffer | number[] }>();
  if (!row) return new Response("Nu există.", { status: 404 });
  const bytes = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : Uint8Array.from(row.data);
  return new Response(bytes, { headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=3600" } });
}
