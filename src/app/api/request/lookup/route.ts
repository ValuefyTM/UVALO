import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { err, json } from "@/lib/api";
import { lookup } from "@/lib/requests";

/** Step 1 of "Solicită cont": the ANEVAR card number → the name from the list. */
export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return err("Serviciul nu este disponibil momentan.", 503);
  return NextResponse.json(await lookup(db, (await json(req)).legit));
}
