import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { page } from "@/lib/guard";
import { devices, getInspection, isOps, team, usableTemplates } from "@/lib/insp";
import { AppShell } from "@/components/AppShell";
import { InspForm, type FormInit } from "@/components/InspForm";

export const metadata: Metadata = { title: "Inspecție nouă | UVALO" };
export const dynamic = "force-dynamic";

const fmt = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Prepare an inspection on the web (or edit one not started yet). */
export default async function InspNou({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const { db, c } = await page();
  const ops = isOps(c);
  if (!c.modules.includes("inspectii") || (!ops && !(await devices(db, c.user.id)).length)) redirect("/inspectii");
  const old = id ? await getInspection(db, c, id) : null;
  // editing a firm's inspection (e.g. as its associated administrator): that firm's people
  const [tpls, cols] = await Promise.all([usableTemplates(db, c), team(db, c, (old as unknown as { org_id?: string | null } | null)?.org_id)]);
  if (old && (old.status === "gata" || old.status === "pred")) redirect(`/inspectii/${old.id}`);
  const init: FormInit = old ? {
    id: old.id, address: old.address, cad_nr: old.cad_nr ?? "", cf_nr: old.cf_nr ?? "", uat: old.uat ?? "", county: old.county ?? "", lat: old.lat, lng: old.lng,
    prop_type: old.prop_type ?? "", area_util: fmt(old.area_util), area_land: fmt(old.area_land), rooms: old.rooms.map((r) => ({ n: r.n, a: fmt(r.a) })),
    template_id: old.template_id ?? tpls[0]?.id ?? "", contact_name: old.contact_name ?? "", contact_phone: old.contact_phone ?? "", contact_role: old.contact_role ?? "",
    date: old.scheduled_at?.slice(0, 10) ?? "", time: old.scheduled_at?.slice(11, 16) ?? "10:00", duration_min: old.duration_min, assignee_kind: old.assignee_kind,
    assignee_id: old.assignee_kind === "office" ? old.assignee_id ?? "" : "", notes: old.notes ?? "",
  } : {
    address: "", cad_nr: "", cf_nr: "", uat: "", county: "", lat: null, lng: null, prop_type: "", area_util: "", area_land: "", rooms: [],
    template_id: tpls[0]?.id ?? "", contact_name: "", contact_phone: "", contact_role: "", date: "", time: "10:00", duration_min: 60, assignee_kind: ops ? (cols.length ? "office" : "collab") : "me", assignee_id: "", notes: "",
  };
  const owner = (o: string) => (o === "uvalo" ? "UVALO" : o === "org" ? "Biroul" : "A mea");
  return (
    <AppShell c={c} active="inspectii" title={old ? `Inspecția ${old.code}` : "Inspecție nouă"} subtitle={old ? old.address : "Pregătești pe web; pe telefon doar o faci"}
      actions={<a className="btn btnGhost" href="/inspectii">← Inspecții</a>}>
      <InspForm init={init} team={cols} ops={ops} canRead={c.super || c.modules.includes("amplasament")}
        tpls={tpls.map((t) => ({ id: t.id, name: t.name, owner: owner(t.owner_type), version: t.version, prop: t.prop_type, enforced: !!t.enforced, tpl: t.published ?? t.draft }))} />
    </AppShell>
  );
}
