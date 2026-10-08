import { NextResponse } from "next/server";
import { api, err } from "@/lib/api";
import { KEY_RE, listUploads, PlanError, refresh, startUpload, uats } from "@/lib/plans";

/** The uploaded plans, brought up to date with their GitHub runs (the admin page asks every few seconds while one runs). */
export async function GET() {
  const a = await api("super");
  if ("res" in a) return a.res;
  const warning = await refresh(a.db).then(() => null, (e) => (e instanceof PlanError ? e.message : "Nu am putut verifica stadiul pe GitHub."));
  return NextResponse.json({ uploads: await listUploads(a.db), warning });
}

const MAX = 95 * 1024 * 1024;
const dec = (v: string | null) => { try { return decodeURIComponent(v ?? "").trim(); } catch { return ""; } };

/**
 * A plan uploaded from the admin panel: the body is the DXF compressed with gzip in the browser; the UAT and the
 * file's details come in headers (x-plan-key, x-plan-name for a new UAT, x-plan-file, x-plan-size, x-plan-date).
 */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const key = (req.headers.get("x-plan-key") ?? "").trim();
  if (!KEY_RE.test(key) || key.length > 40) return err("Alege UAT-ul planului.");
  const list = await uats(req);
  const known = list.find((u) => u.key === key);
  const name = known?.name ?? dec(req.headers.get("x-plan-name")).replace(/\s+/g, " ").slice(0, 60);
  if (!name) return err("Scrie numele UAT-ului nou (cu diacritice).");
  const fileName = dec(req.headers.get("x-plan-file")).slice(0, 160) || `${key}.dxf`;
  if (!/\.dxf$/i.test(fileName)) return err("Încarcă fișierul DXF exportat din ANCPI.");
  const size = Number(req.headers.get("x-plan-size")) || 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.headers.get("x-plan-date") ?? "") ? req.headers.get("x-plan-date") : null;
  const body = await req.blob();
  if (body.size < 100) return err("Fișierul este gol.");
  if (body.size > MAX) return err("Fișierul comprimat depășește 95 MB.");
  const head = new Uint8Array(await body.slice(0, 2).arrayBuffer());
  if (head[0] !== 0x1f || head[1] !== 0x8b) return err("Fișierul nu a fost comprimat în browser. Reîncarcă pagina și încearcă din nou.");
  try {
    const id = await startUpload(a.db, a.c, { key, name, isNew: !known, fileName, size, date, body });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof PlanError) return err(e.message, 409);
    throw e;
  }
}
