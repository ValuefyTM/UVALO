import { NextResponse } from "next/server";
import { api, err, json, str } from "@/lib/api";
import { COOKIE } from "@/lib/auth";
import { deleteUser } from "@/lib/merge";

/** The person deletes their own account; `{ confirm }` must be the account's email. Signs out on every device. */
export async function DELETE(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const confirm = str((await json(req)).confirm, 200).trim().toLowerCase();
  if (confirm !== a.c.user.email.toLowerCase()) return err("Scrie adresa de email a contului, ca să confirmi ștergerea.");
  const r = await deleteUser(a.db, a.c.user, a.c.user.id, true);
  if ("error" in r) return err(r.error!);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
