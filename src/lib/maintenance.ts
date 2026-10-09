// Server-only: maintenance mode. While on, people see /mentenanta instead of the platform; UVALO administrators
// (super-admins) keep using everything. Set from Admin → Panou; read on every page and API call (cached a few
// seconds per worker instance).
import { now } from "./db";

export type Maintenance = { on: boolean; message: string };
const DEFAULT: Maintenance = { on: false, message: "" };
export const DEFAULT_MESSAGE = "Lucrăm la platformă. Revenim în curând.";

let cache: { at: number; v: Maintenance } | null = null;

export async function maintenance(db: D1Database): Promise<Maintenance> {
  if (cache && Date.now() - cache.at < 5000) return cache.v;
  let v = DEFAULT;
  try {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = 'maintenance'").first<{ value: string }>();
    if (row) {
      const d = JSON.parse(row.value) as Partial<Maintenance>;
      v = { on: d.on === true, message: typeof d.message === "string" ? d.message : "" };
    }
  } catch {
    v = DEFAULT; // table not there yet (migration not applied): no maintenance
  }
  cache = { at: Date.now(), v };
  return v;
}

export async function setMaintenance(db: D1Database, actor: string, m: Maintenance) {
  const v: Maintenance = { on: !!m.on, message: m.message.trim().replace(/\s+/g, " ").slice(0, 300) };
  await db.prepare(`INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('maintenance', ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(JSON.stringify(v), now(), actor).run();
  cache = { at: Date.now(), v };
  return v;
}

/** For the layouts: whether maintenance is on (administrators see a strip reminding them). */
export async function maintenanceOn() {
  const { getDb } = await import("./db");
  const db = await getDb();
  return db ? (await maintenance(db)).on : false;
}
