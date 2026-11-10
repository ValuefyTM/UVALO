import { api, err } from "@/lib/api";
import { getFiles } from "@/lib/db";
import { ticketImage } from "@/lib/support";

/** The image of a ticket (`f/<id>`) or of a reply (`r/<id>`): only its owner and the super-admins. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const a = await api("user", { maint: true });
  if ("res" in a) return a.res;
  const { kind, id } = await params;
  const img = await ticketImage(a.db, a.c, kind, Number(id));
  const bucket = await getFiles();
  if (!img || !bucket) return err("Imaginea nu există.", 404);
  const o = await bucket.get(img.key);
  if (!o) return err("Imaginea nu mai există în stocare.", 404);
  return new Response(o.body, { headers: { "Content-Type": img.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
