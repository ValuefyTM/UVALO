import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { collabState } from "@/lib/collab";
import { track } from "@/lib/track";
import { AppShell } from "@/components/AppShell";
import { Colaborari } from "@/components/Colaborari";

export const metadata: Metadata = { title: "Colaborări | UVALO" };
export const dynamic = "force-dynamic";

/** Colaborări: occasional work between valuers (inspections, report + inspection), with zones, requests and chat. */
export default async function ColaborariPage() {
  const { db, c } = await page();
  const on = c.modules.includes("colaborari");
  const state = on ? await collabState(db, c.user) : null;
  if (on) await track(db, c, "colaborari", "page");
  const firmsAsked = on && !!(await db.prepare("SELECT 1 FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify' AND target = 'angajare' LIMIT 1").bind(c.user.id).first());
  return (
    <AppShell c={c} active="colaborari" title="Colaborări" subtitle="Lucrări ocazionale de la colegi: inspecții și rapoarte + inspecție">
      {state ? <Colaborari initial={{ ...state, mode: c.collab }} splash={!state.profile} firmsAsked={firmsAsked} /> : (
        <div className="note">Colaborările vin în curând în UVALO. Le poți urmări din pagina de start („Anunță-mă la lansare”).</div>
      )}
    </AppShell>
  );
}
