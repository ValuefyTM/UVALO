import { api, err, json, str } from "@/lib/api";
import { listApps, revokeApp } from "@/lib/oauth";

/** The apps connected through OAuth (Claude…): list, and `{ id }` to disconnect one. Works in maintenance too. */
export async function GET() {
  const a = await api("user", { maint: true });
  if ("res" in a) return a.res;
  return Response.json({ apps: await listApps(a.db, a.c.user.id) });
}
export async function DELETE(req: Request) {
  const a = await api("user", { maint: true });
  if ("res" in a) return a.res;
  const id = str((await json(req)).id, 60);
  if (!id) return err("Lipsește id.");
  await revokeApp(a.db, a.c.user.id, id);
  return Response.json({ ok: true });
}
