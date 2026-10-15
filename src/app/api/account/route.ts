import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { COOKIE } from "@/lib/auth";
import { cleanPhone } from "@/lib/crypto";
import { closeAccount } from "@/lib/merge";

/** The person's own data: `{ name?, phone? }`. The name only without an ANEVAR card (valuers have it from the Tablou). */
export async function PATCH(req: Request) {
  const a = await api("user", { maint: true });
  if ("res" in a) return a.res;
  const b = await json(req), u = a.c.user;
  const name = str(b.name, 120).replace(/\s+/g, " ");
  const phone = typeof b.phone === "string" ? cleanPhone(b.phone) : undefined;
  if (typeof b.name === "string") {
    if (u.anevar_no) return err("Numele evaluatorilor vine din Tabloul ANEVAR și nu se modifică din cont.");
    if (name.length < 3) return err("Scrie numele și prenumele.");
  }
  // the newsletter about new tools: on / off from „Contul meu” (alone, without name / phone)
  if (typeof b.newsletter === "boolean") {
    await a.db.prepare("UPDATE users SET newsletter = ?, newsletter_at = ? WHERE id = ?").bind(b.newsletter ? 1 : 0, new Date().toISOString(), u.id).run();
    if (typeof b.name !== "string" && typeof b.phone !== "string") return NextResponse.json({ ok: true });
  }
  if (typeof b.phone === "string" && b.phone.trim() && !phone) return err("Numărul de telefon nu pare valid.");
  await a.db.prepare("UPDATE users SET name = COALESCE(?, name), phone = CASE WHEN ? THEN ? ELSE phone END WHERE id = ?")
    .bind(typeof b.name === "string" ? name : null, typeof b.phone === "string" ? 1 : 0, phone || null, u.id).run();
  return NextResponse.json({ ok: true });
}

/** The person closes their own account (`{ confirm: email, reason, note }`): status 'closed', signed out everywhere, nothing deleted. */
export async function DELETE(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  if (str(b.confirm, 200).trim().toLowerCase() !== a.c.user.email.toLowerCase()) return err("Scrie adresa de email a contului, ca să confirmi.");
  const r = await closeAccount(a.db, a.c.user, str(b.reason, 40), str(b.note, 500));
  if ("error" in r) return err(r.error!);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
