import { headers } from "next/headers";
import { api, err, json, str } from "@/lib/api";
import { notifyUser, removeSubscription, saveSubscription, vapid } from "@/lib/webpush";

/** Phone app, notifications: GET = the public key the phone subscribes with. */
export async function GET() {
  const a = await api();
  if ("res" in a) return a.res;
  return Response.json({ key: (await vapid(a.db)).pub });
}

/** POST {sub} = this phone receives notifications; {action: "test"} = a test notification to my phones. */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const b = await json(req);
  if (b.action === "test") {
    const n = await notifyUser(a.db, a.c.user.id, { title: "UVALO Inspecții", body: "Notificările merg. Așa vei afla de inspecțiile noi și de programări.", url: "/", tag: "test" });
    return n ? Response.json({ ok: true, n }) : err("Nu am putut trimite notificarea. Oprește și pornește din nou notificările.");
  }
  const ok = await saveSubscription(a.db, a.c.user.id, (b.sub ?? {}) as Parameters<typeof saveSubscription>[2], (await headers()).get("user-agent") ?? "");
  return ok ? Response.json({ ok: true }) : err("Abonarea la notificări nu este validă.");
}

/** DELETE {endpoint} = this phone stops receiving notifications. */
export async function DELETE(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  await removeSubscription(a.db, a.c.user.id, str((await json(req)).endpoint, 1000));
  return Response.json({ ok: true });
}
