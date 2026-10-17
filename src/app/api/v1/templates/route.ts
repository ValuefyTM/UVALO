import { extTemplates, keyApi } from "@/lib/integration";

/** The sheets an inspection can be made with: the firm's (published; `source: api` = kept in sync by you) and UVALO's. */
export async function GET(req: Request) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  return Response.json({ ok: true, templates: await extTemplates(a.db, a.key) });
}
