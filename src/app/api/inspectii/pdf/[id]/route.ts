import { api, err } from "@/lib/api";
import { getFiles } from "@/lib/db";
import { getInspection } from "@/lib/insp";
import { sheetPdf, sheetPdfName } from "@/lib/insp-pdf";
import { track } from "@/lib/track";

export const dynamic = "force-dynamic";

/** The inspection sheet as a PDF file (everything: answers, rooms, photos, documents, location, signatures), for those who have the inspection. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return a.res;
  const { id } = await params;
  const x = await getInspection(a.db, a.c, id);
  if (!x) return err("Inspecția nu există.", 404);
  // the firm's brand heads the sheet only with the office function (office_at), where its logo is uploaded
  const firm = x.org_id ? await a.db.prepare("SELECT name, corp_no, logo, office_at FROM orgs WHERE id = ?").bind(x.org_id).first<{ name: string; corp_no: string | null; logo: string | null; office_at: string | null }>() : null;
  const keys = new Map((await a.db.prepare("SELECT id, r2_key FROM insp_files WHERE inspection_id = ?").bind(x.id).all<{ id: string; r2_key: string | null }>()).results.map((f) => [f.id, f.r2_key]));
  const bucket = await getFiles();
  const file = async (fid: string) => {
    const k = keys.get(fid);
    if (!k || !bucket) return null;
    const o = await bucket.get(k);
    return o ? new Uint8Array(await o.arrayBuffer()) : null;
  };
  const bytes = await sheetPdf(x, { firm: firm ?? null, pub: false, origin: new URL(req.url).origin, file });
  await track(a.db, a.c, "inspectii", "pdf", x.id);
  return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${sheetPdfName(x)}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
