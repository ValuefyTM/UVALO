import { api, err } from "@/lib/api";
import { getInspection } from "@/lib/insp";

/** Phone app: one inspection with its template snapshot, answers so far and files. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return a.res;
  if (!a.c.modules.includes("inspectii")) return err("Modulul Inspecții nu este disponibil.", 403);
  const x = await getInspection(a.db, a.c, (await params).id);
  return x ? Response.json(x, { headers: { "Cache-Control": "no-store" } }) : err("Inspecția nu există.", 404);
}
