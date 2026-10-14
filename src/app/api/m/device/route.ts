import { headers } from "next/headers";
import { api, json } from "@/lib/api";
import { registerDevice } from "@/lib/insp";

/** Phone app opened while signed in (email code or QR): records / refreshes this phone. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  await registerDevice(a.db, a.c.user.id, a.c.session.id, (await headers()).get("user-agent") ?? "", !!b.standalone);
  return Response.json({ ok: true });
}
