import type { Metadata } from "next";
import { countyOfUats } from "@/lib/plans";
import { notFound } from "next/navigation";
import { fmtDate, superPage } from "@/lib/guard";
import { orgBlock, seatsUsed } from "@/lib/access";
import { activityByDay, getOrg, members, pendingInvites, recentEvents, topTargets } from "@/lib/orgs";
import { AdminShell } from "@/components/AdminShell";
import { MembersPanel, OrgForm } from "@/components/forms";
import { DayBars, EventLog, UatCountTable } from "@/components/Charts";

export const metadata: Metadata = { title: "Firmă | VALUEFY Tools" };
export const dynamic = "force-dynamic";

export default async function AdminOrg({ params }: { params: Promise<{ id: string }> }) {
  const { db, c, pending } = await superPage();
  const { id } = await params;
  const org = await getOrg(db, id);
  if (!org) notFound();
  const [m, inv, used, days, uats, events, { results: plans }] = await Promise.all([
    members(db, id), pendingInvites(db, id), seatsUsed(db, id), activityByDay(db, 30, id), topTargets(db, 30, "uat_open", id), recentEvents(db, { orgId: id, limit: 80 }),
    db.prepare("SELECT id, name FROM plans WHERE active = 1 ORDER BY sort").all<{ id: string; name: string }>(),
  ]);
  const block = orgBlock(org);
  const countyOf = await countyOfUats();
  return (
    <AdminShell c={c} active="firme" pending={pending} title={org.name} subtitle={`Creată ${fmtDate(org.created_at)} · ${org.plan_name} · ${used} / ${org.seats} locuri`} actions={<a className="btn btnGhost btnSm" href="/admin/firme">← Firme</a>}>
      {block && <div className="note">{block}</div>}
      <MembersPanel
        org={id} admin
        members={m.map((x) => ({ user_id: x.user_id, email: x.email, name: x.name, status: x.status, role: x.role, last_seen: x.last_seen_at ? fmtDate(x.last_seen_at, true) : "—", events_30: x.events_30, searches_30: x.searches_30, exports_30: x.exports_30, me: x.user_id === c.user.id }))}
        invites={inv.map((i) => ({ id: i.id, email: i.email, role: i.role, created: fmtDate(i.created_at), expires: fmtDate(i.expires_at), by: i.invited_by_name }))}
        seats={org.seats} used={used} canOwner
      />
      <OrgForm id={id} plans={plans} initial={{
        name: org.name, cui: org.cui ?? "", city: org.city ?? "", plan_id: org.plan_id, seats: org.seats, valid_until: org.valid_until ?? "", status: org.status,
        billing_email: org.billing_email ?? "", notes: org.notes ?? "",
      }} />
      <div className="cols">
        <DayBars days={days} label="Activitate, ultimele 30 de zile" />
        <UatCountTable title="Localități folosite (30 de zile)" rows={uats} countyOf={countyOf} empty="Nicio localitate deschisă încă." />
      </div>
      <EventLog rows={events} showOrg={false} />
    </AdminShell>
  );
}
