import { api, err } from "@/lib/api";
import { firmOrgs, listInspections } from "@/lib/insp";

/**
 * UVALO pentru Word → Anexă foto → „Din inspecții”: the inspections with photos or a sheet started on the phone, newest first — to bring
 * their photos into the annex or their sheet into the document. The office's administrators (and operationals, and associates made
 * administrators) see all the firm's inspections; a valuer sees only the ones they did themselves (not those they prepared for others).
 */
export async function GET() {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.modules.includes("word")) return err("Abonamentul tău nu include UVALO pentru Word.", 403);
  if (!c.modules.includes("inspectii")) return Response.json({ list: [], off: true });
  const firms = firmOrgs(c);
  const all = (await listInspections(db, c)).filter((r) => r.assignee_id === c.user.id || (!!r.org_id && firms.includes(String(r.org_id))));
  const list = all.filter((r) => r.photos > 0 || ["lucru", "gata", "pred"].includes(r.status)).slice(0, 300).map((r) => ({
    id: r.id, code: r.code, address: r.address, prop_type: r.prop_type, cad_nr: r.cad_nr, status: r.status, photos: r.photos,
    sheet: ["lucru", "gata", "pred"].includes(r.status), sheet_no: r.sheet_no, when: r.finished_at ?? r.scheduled_at, who: r.assignee_name,
  }));
  return Response.json({ list }, { headers: { "Cache-Control": "no-store" } });
}
