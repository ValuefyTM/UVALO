import { api, err, json, str } from "@/lib/api";
import { track } from "@/lib/track";
import { devices, inspAction, pairCode, revokeDevice, saveInspection, testDevice, tplAction } from "@/lib/insp";

/**
 * Inspecții (module `inspectii`, in test: super-admins only). POST {action}:
 * save (new / edit), schedule, status, delete, simulate (test), tpl_new, tpl_duplicate, tpl_save, tpl_publish, tpl_delete,
 * pair_code, device_status (the web waits for the phone), test_device, revoke_device.
 */
export async function POST(req: Request) {
  const a = await api();
  if ("res" in a) return a.res;
  const { db, c } = a;
  if (!c.modules.includes("inspectii")) return err("Modulul Inspecții nu este încă disponibil.", 403);
  const b = await json(req);
  const action = str(b.action, 30);
  let r: { ok: true; id?: string } | { error: string };
  if (action === "save") r = await saveInspection(db, c, b);
  else if (action.startsWith("tpl_")) r = await tplAction(db, c, b);
  else if (action === "pair_code") return Response.json({ code: await pairCode(db, c.user.id), uid: c.user.id });
  else if (action === "device_status") return Response.json({ devices: (await devices(db, c.user.id)).length });
  else if (action === "test_device") { await testDevice(db, c.user.id); r = { ok: true }; }
  else if (action === "revoke_device") { await revokeDevice(db, c.user.id, str(b.id, 64)); r = { ok: true }; }
  else r = await inspAction(db, c, b);
  if ("error" in r) return err(r.error);
  await track(db, c, "inspectii", action, r.id ?? null, { test: 1 });
  return Response.json(r);
}
