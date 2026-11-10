import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { track } from "@/lib/track";
import { PROMPT_DEFAULTS, type PromptKey, prompts, setPrompts } from "@/lib/tools";

/** Saves the AI prompts of the site analysis; an empty text (or the default one) goes back to the default. */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const change: Partial<Record<PromptKey, string>> = {};
  for (const k of Object.keys(PROMPT_DEFAULTS) as PromptKey[]) if (typeof b[k] === "string") change[k] = b[k] as string;
  if (!Object.keys(change).length) return err("Nimic de salvat.");
  await setPrompts(a.db, a.c.user.id, change);
  await track(a.db, a.c, "admin", "prompts", Object.keys(change).join(","));
  const p = await prompts(a.db);
  return NextResponse.json({ ok: true, changed: p.changed });
}
