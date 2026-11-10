// The mode of a module in test (Dezactivat / Test / Activ) and its test group, like Colaborări: app_settings "<key>_mode" =
// {mode, users}. Used by Inspecții (Admin → Instrumente → Inspecții).
import { now } from "./db";
import type { CollabMode } from "./collab-shared";

export type ModeSettings = { mode: CollabMode; users: string[] };
const cache = new Map<string, { at: number; v: ModeSettings }>();

export async function modeSettings(db: D1Database, key: string): Promise<ModeSettings> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < 5000) return c.v;
  let d: Partial<ModeSettings> = {};
  try {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").bind(`${key}_mode`).first<{ value: string }>();
    if (row) d = JSON.parse(row.value);
  } catch {}
  const v: ModeSettings = {
    mode: d.mode === "on" || d.mode === "test" ? d.mode : "off",
    users: Array.isArray(d.users) ? d.users.filter((x): x is string => typeof x === "string") : [],
  };
  cache.set(key, { at: Date.now(), v });
  return v;
}

export async function setModeSettings(db: D1Database, key: string, actor: string, v: ModeSettings) {
  await db.prepare(`INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(`${key}_mode`, JSON.stringify(v), now(), actor).run();
  cache.set(key, { at: Date.now(), v });
  return v;
}

/** Super-admins always; in Test the chosen people; when Activ, everyone with access to the platform. */
export function modeAllowed(s: ModeSettings, c: { super: boolean; userId: string; hasAccess: boolean }) {
  if (c.super) return true;
  if (s.mode === "test") return s.users.includes(c.userId);
  return s.mode === "on" && c.hasAccess;
}
