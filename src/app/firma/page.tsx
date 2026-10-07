import type { Metadata } from "next";
import { fmtDate, orgAdminPage } from "@/lib/guard";
import { orgBlock, seatsUsed } from "@/lib/access";
import { activityByDay, members, pendingInvites, recentEvents, topTargets } from "@/lib/orgs";
import { AppShell } from "@/components/AppShell";
import { MembersPanel } from "@/components/forms";
import { CountTable, DayBars, EventLog } from "@/components/Charts";

export const metadata: Metadata = { title: "Firma mea | VALUEFY Tools" };
export const dynamic = "force-dynamic";

export default async function Firm() {
  const { db, c } = await orgAdminPage();
  const org = c.org!;
  const [m, inv, used, days, uats, events] = await Promise.all([
    members(db, org.id), pendingInvites(db, org.id), seatsUsed(db, org.id), activityByDay(db, 30, org.id), topTargets(db, 30, "uat_open", org.id), recentEvents(db, { orgId: org.id, limit: 50 }),
  ]);
  const block = orgBlock(org);
  return (
    <AppShell c={c} active="firma" title={org.name} subtitle={`${org.seats} ${org.seats === 1 ? "loc" : "locuri"} în echipă`}>
      {block && <div className="note">{block}</div>}
      <MembersPanel
        members={m.map((x) => ({ user_id: x.user_id, email: x.email, name: x.name, status: x.status, role: x.role, last_seen: x.last_seen_at ? fmtDate(x.last_seen_at, true) : "—", events_30: x.events_30, searches_30: x.searches_30, exports_30: x.exports_30, me: x.user_id === c.user.id }))}
        invites={inv.map((i) => ({ id: i.id, email: i.email, role: i.role, created: fmtDate(i.created_at), expires: fmtDate(i.expires_at), by: i.invited_by_name }))}
        seats={org.seats} used={used} canOwner={c.super || c.role === "owner"}
      />
      <div className="cols">
        <DayBars days={days} label="Activitatea firmei, ultimele 30 de zile" />
        <CountTable title="Localități folosite (30 de zile)" rows={uats.map((u) => [u.target, u.n, u.u])} head={["UAT", "Deschideri", "Persoane"]} empty="Nicio localitate deschisă încă." />
      </div>
      <EventLog rows={events} showOrg={false} />
    </AppShell>
  );
}
