import { api, json } from "@/lib/api";
import { keyAction, listKeys } from "@/lib/integration";

/** "Firma mea" → Integrare: the firm's API keys and their webhooks (owners / administrators). */
export async function GET() {
  const a = await api("orgAdmin");
  if ("res" in a) return a.res;
  return Response.json({ ok: true, keys: await listKeys(a.db, a.c.org!.id) });
}

/** `{ action: create, name }` (the key is shown once) · `{ action: revoke, id }` · `{ action: webhook, id, url, new_secret? }`. */
export async function POST(req: Request) {
  const a = await api("orgAdmin");
  if ("res" in a) return a.res;
  const r = await keyAction(a.db, a.c.org!.id, a.c.user.id, await json(req));
  return "error" in r ? Response.json(r, { status: 400 }) : Response.json(r);
}
