import { api, err } from "@/lib/api";
import { getFiles } from "@/lib/db";
import { track } from "@/lib/track";
import { addFile } from "@/lib/insp";

/**
 * Upload a document or photo of an inspection to the private bucket (R2 `uvalo-inspectii`).
 * multipart: id (inspection), kind (cf | releveu | doc | photo | signature), file; for photos also room, taken_at, lat, lng.
 */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.modules.includes("inspectii")) return err("Modulul Inspecții nu este încă disponibil.", 403);
  const bucket = await getFiles();
  if (!bucket) return err("Stocarea fișierelor nu este configurată (bucketul R2 FILES).", 503);
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("file");
  if (!(f instanceof File)) return err("Alege fișierul.");
  const g = (k: string) => (typeof fd!.get(k) === "string" ? (fd!.get(k) as string) : undefined);
  const r = await addFile(db, bucket, c, g("id") ?? "", f, { kind: g("kind") ?? "doc", name: g("name"), room: g("room"), taken_at: g("taken_at"), lat: g("lat"), lng: g("lng") });
  if ("error" in r) return err(r.error);
  await track(db, c, "inspectii", "file_add", g("id") ?? null, { kind: g("kind"), kb: Math.round(f.size / 1024), test: 1 });
  return Response.json(r);
}
