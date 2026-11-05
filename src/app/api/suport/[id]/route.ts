import { NextResponse } from "next/server";
import { api, err } from "@/lib/api";
import { getFiles } from "@/lib/db";
import { replyTicket } from "@/lib/support";

/** The person writes back in their ticket's thread (multipart: text, image?). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api();
  if ("res" in a) return a.res;
  const fd = await req.formData().catch(() => null);
  if (!fd) return err("Cerere invalidă.");
  const r = await replyTicket(a.db, await getFiles(), a.c, Number((await params).id), { text: fd.get("text"), image: fd.get("image") }, false);
  if ("error" in r) return err(r.error, r.status ?? 400);
  return NextResponse.json({ ok: true });
}
