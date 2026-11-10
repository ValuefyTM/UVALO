import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { consumeLink, createSession, currentSession } from "@/lib/auth";

/** One-time sign-in link from an email; `next` = page of the app to open (e.g. a post in Colaborări). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = await getDb();
  const token = url.searchParams.get("token") ?? "";
  const n = url.searchParams.get("next") ?? "";
  const next = /^\/(?![/\\])[^\s\\]*$/.test(n) ? n : "/";
  // already signed in on this device: the link is not used up, just open the page
  if (db && (await currentSession(db))) return NextResponse.redirect(new URL(next, url));
  const u = db && token ? await consumeLink(db, token) : null;
  if (!db || !u) return NextResponse.redirect(new URL(`/login?link=expired${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`, url));
  const res = NextResponse.redirect(new URL(next, url));
  res.cookies.set(await createSession(db, u.id));
  return res;
}
