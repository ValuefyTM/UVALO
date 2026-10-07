import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { consumeLink, createSession } from "@/lib/auth";

/** One-time sign-in link from the email. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = await getDb();
  const token = url.searchParams.get("token") ?? "";
  const u = db && token ? await consumeLink(db, token) : null;
  if (!db || !u) return NextResponse.redirect(new URL("/login?link=expired", url));
  const res = NextResponse.redirect(new URL("/", url));
  res.cookies.set(await createSession(db, u.id));
  return res;
}
