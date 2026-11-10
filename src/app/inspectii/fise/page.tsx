import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { page } from "@/lib/guard";
import { templates } from "@/lib/insp";
import { AppShell } from "@/components/AppShell";
import { InspTemplates } from "@/components/InspTemplates";

export const metadata: Metadata = { title: "Fișe de inspecție | UVALO" };
export const dynamic = "force-dynamic";

/** Fișe de inspecție: the templates (the firm's shared ones, the person's own, the UVALO defaults). */
export default async function InspFise({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const { db, c } = await page();
  if (!c.modules.includes("inspectii")) redirect("/inspectii");
  const canOrg = !!c.org && (c.super || c.role === "owner" || c.role === "admin");
  const items = (await templates(db, c)).map((t) => ({
    id: t.id, owner: t.owner_type, name: t.name, prop: t.prop_type, draft: t.draft, version: t.version, enforced: !!t.enforced, dirty: t.dirty,
    editable: t.owner_type === "user" || (t.owner_type === "org" && canOrg),
  }));
  return (
    <AppShell c={c} active="inspectii" title="Fișe de inspecție" subtitle="Grupuri, întrebări și răspunsuri precompletate; fiecare publicare e o versiune nouă"
      actions={<a className="btn btnGhost" href="/inspectii">← Inspecții</a>}>
      <InspTemplates items={items} canOrg={canOrg} start={id} />
    </AppShell>
  );
}
