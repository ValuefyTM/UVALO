import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { collabState } from "@/lib/collab";
import { track } from "@/lib/track";
import { AppShell } from "@/components/AppShell";
import { Colaborari } from "@/components/Colaborari";

export const metadata: Metadata = { title: "Colaborări | UVALO" };
export const dynamic = "force-dynamic";

/** Colaborări: occasional work between valuers (inspections, report + inspection), with zones, requests and chat. */
export default async function ColaborariPage({ searchParams }: { searchParams: Promise<{ post?: string; view?: string; conv?: string; compose?: string }> }) {
  const { post, view, conv, compose } = await searchParams;
  const start = (["mine", "chat", "settings"] as const).find((v) => v === view);
  const { db, c } = await page();
  const on = c.modules.includes("colaborari");
  const state = on ? await collabState(db, c.user) : null;
  if (on) await track(db, c, "colaborari", "page");
  const firmsAsked = on && !!(await db.prepare("SELECT 1 FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify' AND target = 'angajare' LIMIT 1").bind(c.user.id).first());
  return (
    <AppShell c={c} active="colaborari" title="Colaborări" subtitle="Lucrări ocazionale de la colegi: inspecții și rapoarte + inspecție">
      {state ? <Colaborari initial={{ ...state, mode: c.collab }} firmsAsked={firmsAsked} post={typeof post === "string" && /^[\w-]{8,64}$/.test(post) ? post : undefined}
        start={start} startConv={typeof conv === "string" && /^[\w-]{8,64}$/.test(conv) ? conv : undefined} compose={compose === "1"} /> : (
        <div className="note">Colaborările vin în curând în UVALO. Le poți urmări din pagina de start („Anunță-mă la lansare”).</div>
      )}
    </AppShell>
  );
}
