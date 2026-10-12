import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { track } from "@/lib/track";
import {
  collabState, createPost, messages, openConversation, pickRequest, readNotifs, requestDetails, saveProfile, sendMessage, setPostStatus, withdrawRequest,
} from "@/lib/collab";

export const dynamic = "force-dynamic";

async function access() {
  const a = await api();
  if ("res" in a) return a;
  if (!a.c.modules.includes("colaborari")) return { res: err("Colaborările nu sunt disponibile pentru contul tău.", 403) };
  return a;
}

/** The page's data (?conv=<id>: the messages of one conversation, which also marks it read). */
export async function GET(req: Request) {
  const a = await access();
  if ("res" in a) return a.res;
  const conv = new URL(req.url).searchParams.get("conv");
  if (conv) {
    const m = await messages(a.db, a.c.user, conv);
    return m ? NextResponse.json({ messages: m }) : err("Conversația nu mai există.", 404);
  }
  return NextResponse.json({ ...(await collabState(a.db, a.c.user)), mode: a.c.collab });
}

const ACTIONS = {
  profile: async (db: D1Database, me: { id: string; name: string; email: string }, b: Record<string, unknown>) => ({ ok: true, ...(await saveProfile(db, me.id, b)) }),
  post: createPost, request: requestDetails, withdraw: withdrawRequest, open_chat: openConversation, pick: pickRequest, status: setPostStatus,
  message: sendMessage, read: readNotifs,
} as const;
// usage statistics in Admin → Instrumente → Colaborări (messages and read marks are not counted)
const TRACK: Partial<Record<keyof typeof ACTIONS, string>> = { profile: "profile", post: "post", request: "request", open_chat: "open_chat", pick: "pick", status: "post_status" };

export async function POST(req: Request) {
  const a = await access();
  if ("res" in a) return a.res;
  const b = await json(req);
  const action = String(b.action ?? "") as keyof typeof ACTIONS;
  const fn = ACTIONS[action];
  if (!fn) return err("Acțiune necunoscută.");
  const r = (await fn(a.db, a.c.user, b)) as { error?: string };
  if (r.error) return err(r.error);
  if (TRACK[action]) await track(a.db, a.c, "colaborari", TRACK[action]!, typeof b.post_id === "string" ? b.post_id : null, a.c.collab === "on" ? undefined : { test: 1 });
  return NextResponse.json(r);
}
