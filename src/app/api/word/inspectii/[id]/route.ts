import { api, err } from "@/lib/api";
import { firmOrgs, getInspection } from "@/lib/insp";
import { photoCategories } from "@/lib/insp-shared";
import { track } from "@/lib/track";
import { sheetHtml, sheetReady } from "@/lib/word-insp";

/**
 * One inspection for the Word pane: its photos (by category, in the order taken; each file from /api/inspectii/file/<id>) and,
 * with `?sheet=1`, the sheet as HTML to insert at the cursor.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.modules.includes("word") || !c.modules.includes("inspectii")) return err("Nu ai acces la inspecții din Word.", 403);
  const x = await getInspection(db, c, (await params).id);
  // as in the list: the firm's administrators see all its inspections, a valuer only the ones they did
  if (!x || !(c.super || x.assignee_id === c.user.id || (!!x.org_id && firmOrgs(c).includes(String(x.org_id))))) return err("Inspecția nu există sau nu ai acces la ea.", 404);
  const photos = x.files.filter((f) => f.kind === "photo").map((f) => ({ id: f.id, room: f.room, name: f.name, taken_at: f.taken_at }));
  const title = `${x.prop_type ?? "Imobil"} · ${x.address}`;
  // the photo categories in the sheet's order (Exterior first…), so the annex starts in the usual order
  const pc = photoCategories(x.prop_type, x.template.photos), cats = [...pc.before, ...pc.after];
  if (new URL(req.url).searchParams.get("sheet") !== "1") return Response.json({ id: x.id, code: x.code, title, photos, cats }, { headers: { "Cache-Control": "no-store" } });
  if (!sheetReady(x)) return err("Fișa nu a fost începută pe telefon: nu are încă răspunsuri de inserat.", 409);
  await track(db, c, "word", "insert_sheet", x.id);
  return Response.json({ id: x.id, title, sheet_no: x.sheet_no, html: sheetHtml(x) }, { headers: { "Cache-Control": "no-store" } });
}
