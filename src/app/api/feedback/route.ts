import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { getFiles } from "@/lib/db";
import { createTicket } from "@/lib/support";

/**
 * A new ticket: from the floating feedback button (JSON: kind, text, page, contact) or from /suport (multipart, with an
 * optional image). Saved for Admin → Feedback and the person's /suport; the UVALO administrators get an email.
 */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const ct = req.headers.get("content-type") ?? "";
  let b: { kind?: unknown; subject?: unknown; text?: unknown; page?: unknown; contact?: unknown; image?: unknown };
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return err("Cerere invalidă.");
    b = { kind: fd.get("kind"), subject: fd.get("subject"), text: fd.get("text"), page: fd.get("page"), contact: fd.get("contact"), image: fd.get("image") };
  } else b = await json(req);
  const r = await createTicket(a.db, await getFiles(), a.c, req.headers.get("user-agent") ?? "", b);
  if ("error" in r) return err(r.error, r.status ?? 400);
  return NextResponse.json({ ok: true, id: r.id });
}
