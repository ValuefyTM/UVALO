import type { Metadata } from "next";
import { page } from "@/lib/guard";
import { track } from "@/lib/track";
import { devices, inspUrl, listInspections, phoneNotifs } from "@/lib/insp";
import { AppShell } from "@/components/AppShell";
import { InspBell } from "@/components/InspBell";
import { InspActivate } from "@/components/InspActivate";
import { InspList } from "@/components/InspList";
import { InspPreview } from "@/components/InspPreview";
import { InspSettings } from "@/components/InspSettings";

export const metadata: Metadata = { title: "Inspecții | UVALO" };
export const dynamic = "force-dynamic";

/** Inspecții: prepared here, done on the phone (UVALO app), seen here. Who has it: by its mode (Admin → Instrumente → Inspecții). */
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
  if (!devs.length) {
    return (
      <AppShell c={c} active="inspectii" title="Inspecții" dark subtitle={c.insp === "on" ? "Conectează telefonul" : "Modul în test"} actions={<InspPreview appUrl={inspUrl()} />}>
        <InspActivate testMode={c.super} appUrl={inspUrl()} />
      </AppShell>
    );
  }
  const [rows, notifs] = await Promise.all([listInspections(db, c.user.id), phoneNotifs(db, c.user.id)]);
  const dev = devs[0];
  return (
    <AppShell c={c} active="inspectii" title="Inspecții" dark subtitle="Le pregătești aici; pe telefon doar le faci. Fișele, pozele și actele se văd aici."
      actions={<>
        <span className="inDev" title={dev.platform === "test" ? "Mod de test, fără telefon" : "Telefonul conectat"}><i />{dev.platform === "test" ? "Mod test (fără telefon)" : `Telefon conectat · ${dev.name ?? ""}`}</span>
        <InspPreview appUrl={inspUrl()} />
        <InspBell items={notifs} />
        <InspSettings />
      </>}>
      {c.insp !== "on" && <div className="note inTestNote">Modul în test: îl văd administratorii UVALO și grupul de test. Datele introduse acum sunt marcate ca date de test.</div>}
      <InspList rows={rows} meId={c.user.id} />
    </AppShell>
  );
}
