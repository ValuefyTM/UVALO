// Server-only: usage tracking (what each person does in each module).
import type { Ctx } from "./access";

export async function track(db: D1Database, c: Pick<Ctx, "user" | "session" | "org"> | null, module: string, action: string, target?: string | null, meta?: unknown) {
  try {
    await db
      .prepare("INSERT INTO events (user_id, org_id, session_id, module, action, target, meta) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(c?.user.id ?? null, c?.org?.id ?? null, c?.session.id ?? null, module.slice(0, 30), action.slice(0, 40), target ? String(target).slice(0, 120) : null,
        meta === undefined ? null : JSON.stringify(meta).slice(0, 1000))
      .run();
  } catch (e) {
    console.error("[track]", e);
  }
}
