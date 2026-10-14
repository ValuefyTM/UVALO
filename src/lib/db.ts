import { getCloudflareContext } from "@opennextjs/cloudflare";

/** The UVALO database (valuefy-tools-db), or null when unavailable. */
export async function getDb(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { DB?: D1Database }).DB ?? null;
  } catch {
    return null;
  }
}

/** The private file bucket (R2 `uvalo-inspectii`): inspection photos and documents. Null when not bound. */
export async function getFiles(): Promise<R2Bucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { FILES?: R2Bucket }).FILES ?? null;
  } catch {
    return null;
  }
}

export async function requireDb(): Promise<D1Database> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();
