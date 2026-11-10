import { api, err, json } from "@/lib/api";
import { track } from "@/lib/track";
import { phoneEdit } from "@/lib/insp";

/** Phone app: „Editează” on an inspection the person added herself (see phoneEdit). */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.modules.includes("inspectii")) return err("Modulul Inspecții nu este încă disponibil.", 403);
  const r = await phoneEdit(db, c, await json(req));
  if ("error" in r) return err(r.error);
  await track(db, c, "inspectii", "phone_edit", r.id, { test: 1 });
  return Response.json(r);
}
