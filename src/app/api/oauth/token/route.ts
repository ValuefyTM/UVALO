import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exchange } from "@/lib/oauth";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*", "Cache-Control": "no-store" };

/** The token endpoint (form-urlencoded or JSON): authorization_code + PKCE, refresh_token. */
export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "server_error", error_description: "Baza de date nu este disponibilă." }, { status: 503, headers: cors });
  const ct = req.headers.get("content-type") ?? "";
  let b: Record<string, unknown> = {};
  if (ct.includes("application/json")) b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  else b = Object.fromEntries(new URLSearchParams(await req.text().catch(() => "")));
  // client credentials in a Basic header (some clients send them even for public clients)
  const basic = (req.headers.get("authorization") ?? "").match(/^Basic\s+(.+)$/i);
  if (basic && !b.client_id) { try { b.client_id = atob(basic[1]).split(":")[0]; } catch { /* ignore */ } }
  const r = await exchange(db, b);
  return NextResponse.json(r.body, { status: r.status, headers: cors });
}
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
