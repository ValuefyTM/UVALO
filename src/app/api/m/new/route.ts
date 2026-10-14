import { api, err, json } from "@/lib/api";
import { track } from "@/lib/track";
import { saveInspection } from "@/lib/insp";

/** Phone app: a new inspection started on the phone (done by the same person; the rest can be completed on the web). */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.modules.includes("inspectii")) return err("Modulul Inspecții nu este încă disponibil.", 403);
  const b = await json(req);
  const r = await saveInspection(db, c, { ...b, id: "", assignee_kind: "me", assignee_id: "", from_phone: 1, from_doc: 0 });
  if ("error" in r) return err(r.error);
  await track(db, c, "inspectii", "phone_new", r.id, { test: 1 });
  return Response.json(r);
}
