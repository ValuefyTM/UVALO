import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { registerClient } from "@/lib/oauth";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*" };

/** Dynamic client registration (RFC 7591): Claude registers itself before the first sign-in. */
export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "server_error", error_description: "Baza de date nu este disponibilă." }, { status: 503, headers: cors });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = await registerClient(db, b);
  return NextResponse.json(r, { status: "error" in r ? 400 : 201, headers: cors });
}
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
