// Server-only: the cadastral locator page and its data live in the worker's static assets under /_localizare/,
// which only the worker can read (wrangler.jsonc: run_worker_first). They are served to people with access to the module.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "./db";
import { context, type Ctx } from "./access";

export async function locatorAsset(path: string, req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const assets = (env as { ASSETS?: { fetch: (r: Request) => Promise<Response> } }).ASSETS;
  if (!assets) return null;
  const res = await assets.fetch(new Request(new URL(`/_localizare/${path}`, req.url), { headers: { "Accept-Encoding": req.headers.get("accept-encoding") ?? "" } }));
  return res.ok ? res : null;
}

/** The signed-in person when they may use the locator; otherwise why not. */
export async function locatorAccess(): Promise<{ db: D1Database; c: Ctx } | { status: 401 | 403 | 503; c?: Ctx }> {
  const db = await getDb();
  if (!db) return { status: 503 };
  const c = await context(db);
  if (!c) return { status: 401 };
  if (!c.modules.includes("localizare")) return { status: 403, c };
  return { db, c };
}
