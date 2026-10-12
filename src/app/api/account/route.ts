import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { COOKIE } from "@/lib/auth";
import { closeAccount } from "@/lib/merge";

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
