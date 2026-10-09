import type { Metadata } from "next";
import { countyOfUats } from "@/lib/plans";
import { superPage } from "@/lib/guard";
import { activityByDay, actionLabel, recentEvents, topActions, topTargets } from "@/lib/orgs";
import { AdminShell } from "@/components/AdminShell";
import { CountTable, DayBars, EventLog, UatCountTable } from "@/components/Charts";

export const metadata: Metadata = { title: "Activitate | UVALO" };
export const dynamic = "force-dynamic";

export default async function AdminActivity({ searchParams }: { searchParams: Promise<{ user?: string; org?: string; action?: string }> }) {
  const { db, c, pending } = await superPage();
  const f = await searchParams;
  const who = f.user ? await db.prepare("SELECT COALESCE(NULLIF(name, ''), email) AS n FROM users WHERE id = ?").bind(f.user).first<{ n: string }>() : null;
  const [days, acts, uats, parcels, events] = await Promise.all([
    activityByDay(db, 30, f.org, f.user), topActions(db, 30, f.org), topTargets(db, 30, "uat_open", f.org), topTargets(db, 30, "parcel", f.org),
    recentEvents(db, { userId: f.user, orgId: f.org, action: f.action, limit: 300 }),
  ]);
  const countyOf = await countyOfUats();
  return (
    <AdminShell c={c} active="activitate" pending={pending} title="Activitate" subtitle={who ? `Filtrat: ${who.n}` : "Ce fac utilizatorii în platformă"} actions={who ? <a className="btn btnGhost btnSm" href="/admin/activitate">Toată activitatea</a> : undefined}>
      <DayBars days={days} label="Acțiuni pe zi, ultimele 30 de zile" />
      <div className="cols">
        <CountTable title="Ce se folosește (30 de zile)" rows={acts.map((a) => [`${actionLabel(a.action)}${a.module !== "localizare" ? ` · ${a.module}` : ""}`, a.n])} head={["Acțiune", "De câte ori"]} empty="Nicio activitate." />
        <UatCountTable title="Localități (30 de zile)" rows={uats} countyOf={countyOf} empty="—" />
      </div>
      <CountTable title="Parcele deschise cel mai des (30 de zile)" rows={parcels.map((u) => [u.target, u.n, u.u])} head={["Nr. cadastral", "Deschideri", "Persoane"]} empty="—" />
      <EventLog rows={events} />
    </AdminShell>
  );
}
