import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { COOKIE, endSession } from "@/lib/auth";

export async function POST() {
  const db = await getDb();
  if (db) await endSession(db);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
