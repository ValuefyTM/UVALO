import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";

/** Admin → Feedback: status (nou / citit / rezolvat) and the internal note of a message. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  const id = Number((await params).id);
  const status = ["nou", "citit", "rezolvat"].includes(String(b.status)) ? String(b.status) : null;
  if (!Number.isInteger(id) || (!status && b.note === undefined)) return err("Cerere invalidă.");
  if (status) await a.db.prepare("UPDATE feedback SET status = ? WHERE id = ?").bind(status, id).run();
  if (b.note !== undefined) await a.db.prepare("UPDATE feedback SET note = ? WHERE id = ?").bind(str(b.note, 1000) || null, id).run();
  return NextResponse.json({ ok: true });
}
