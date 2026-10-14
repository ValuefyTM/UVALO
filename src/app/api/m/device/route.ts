import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { api, json } from "@/lib/api";
import { COOKIE } from "@/lib/auth";
import { disconnectPhone, registerDevice } from "@/lib/insp";

/** Phone app opened while signed in (email code or QR): records / refreshes this phone. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  await registerDevice(a.db, a.c.user.id, a.c.session.id, (await headers()).get("user-agent") ?? "", !!b.standalone);
  return Response.json({ ok: true });
}

/** "Deconectează telefonul": out of the list on the web, signed out here. */
export async function DELETE() {
  const a = await api();
  if ("res" in a) return a.res;
  await disconnectPhone(a.db, a.c.user.id, a.c.session.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
