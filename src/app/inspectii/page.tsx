import type { Metadata } from "next";
import { page, initials } from "@/lib/guard";
import { track } from "@/lib/track";
import { devices, firmView, inspUrl, isOps, listInspections, phoneNotifs } from "@/lib/insp";
import { AppShell } from "@/components/AppShell";
import { InspBell } from "@/components/InspBell";
import { InspActivate } from "@/components/InspActivate";
import { InspList } from "@/components/InspList";
import { InspPreview } from "@/components/InspPreview";
import { InspSettings } from "@/components/InspSettings";

export const metadata: Metadata = { title: "Inspecții | UVALO" };
export const dynamic = "force-dynamic";

const TZ = "Europe/Bucharest";

/** Inspecții: prepared here, done on the phone (UVALO app), seen here. The page opens in Listă + hartă (InspList). */
export default async function InspectiiPage() {
  const { db, c } = await page();
  if (!c.modules.includes("inspectii")) {
    return (
      <AppShell c={c} active="inspectii" title="Inspecții">
        <div className="note">Modulul Inspecții este în pregătire și va fi disponibil în curând.</div>
      </AppShell>
    );
  }
  const devs = await devices(db, c.user.id);
  await track(db, c, "inspectii", "page", null, { test: 1 });
  // operationals do no inspections: no phone needed
  const ops = isOps(c);
  if (!devs.length && !ops) {
    return (
      <AppShell c={c} active="inspectii" title="Inspecții" dark subtitle="Conectează telefonul" actions={<InspPreview appUrl={inspUrl()} />}>
        <InspActivate testMode={c.super} appUrl={inspUrl()} />
      </AppShell>
    );
  }
  const [rows, notifs] = await Promise.all([listInspections(db, c), phoneNotifs(db, c.user.id)]);
  // the line under the title: how many, today's, on site now
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const todayN = rows.filter((r) => r.scheduled_at?.startsWith(today) && (r.status === "plan" || r.status === "lucru")).length;
  const onSite = rows.filter((r) => r.status === "lucru").length;
  const sub = [`${rows.length} în total`, todayN ? `${todayN} azi` : null, onSite ? `${onSite === 1 ? "una" : onSite} pe teren acum` : null].filter(Boolean).join(" · ");
  return (
    <AppShell c={c} active="inspectii" title="Inspecții" dark subtitle={sub}
      actions={<>
        <InspBell items={notifs} />
        <InspSettings appUrl={inspUrl()} phones={devs.filter((d) => d.platform !== "test").length} />
        {!ops && <a className="btn btnGold ixNew" href="/inspectii/nou"><span aria-hidden="true">+</span> Inspecție nouă</a>}
        <a className="hbAv" href="/cont" title="Contul meu" aria-label="Contul meu">
          {c.user.has_avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`/api/avatar/${c.user.id}`} alt="" />
            : initials(c.user.name, c.user.email)}
        </a>
      </>}>
      <InspList rows={rows} meId={c.user.id} ops={ops}
        // the administrator's own office is "Ale mele"; an operational's office and the offices that made them an associated administrator: "Ale firmei"
        mergeOrg={firmView(c) && !ops ? c.org!.id : null} firmOrgs={[...(ops ? [c.org!.id] : []), ...c.linkAdmin]} />
    </AppShell>
  );
}
