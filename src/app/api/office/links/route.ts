import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { linkAction, searchOffices } from "@/lib/links";

/** Offices a valuer can ask to join (`?q=` name). */
export async function GET(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  if (!a.c.user.anevar_no) return NextResponse.json({ offices: [] });
  return NextResponse.json({ offices: await searchOffices(a.db, a.c.user.id, new URL(req.url).searchParams.get("q") ?? "") });
}

/** Asocieri: `{ action: invite | request | accept | decline | approve | reject | cancel | end | kind, ... }`. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const r = await linkAction(a.db, a.c, await json(req));
  return "error" in r ? err(r.error) : NextResponse.json(r);
}
