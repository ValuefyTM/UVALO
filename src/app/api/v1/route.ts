import { keyApi } from "@/lib/integration";

/** Integration API: checks the key and says which firm it belongs to. */
export async function GET(req: Request) {
  const a = await keyApi(req);
  if ("res" in a) return a.res;
  const org = await a.db.prepare("SELECT id, name FROM orgs WHERE id = ?").bind(a.key.org_id).first<{ id: string; name: string }>();
  return Response.json({ ok: true, org, key: a.key.name, version: 1 });
}
