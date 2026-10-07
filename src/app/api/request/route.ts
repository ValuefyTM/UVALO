import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { err, json } from "@/lib/api";
import { createRequest } from "@/lib/requests";

/** Step 2 of "Solicită cont": card number + email (+ phone, firm) → request waiting for approval. */
export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return err("Serviciul nu este disponibil momentan.", 503);
  const r = await createRequest(db, await json(req));
  if (!r.ok) return err(r.error);
  return NextResponse.json({ ok: true, name: r.name });
}
