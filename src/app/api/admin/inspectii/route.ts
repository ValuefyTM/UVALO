import { NextResponse } from "next/server";
import { api, err, json } from "@/lib/api";
import { audit } from "@/lib/auth";
import { sendInspLaunchEmails } from "@/lib/insp-launch";

/** Inspecții in the administration: the launch email ("Inspecțiile au ajuns în UVALO"), once per person. The module has no modes any more. */
export async function POST(req: Request) {
  const a = await api("super");
  if ("res" in a) return a.res;
  const b = await json(req);
  if (b.action !== "launch_mail") return err("Acțiune necunoscută.");
  const r = await sendInspLaunchEmails(a.db, b.all === true);
  await audit(a.db, a.c.user.id, "insp.launch_mail", "inspectii", undefined, String(r.sent));
  return NextResponse.json({ ok: true, sent: r.sent });
}
