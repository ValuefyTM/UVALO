import type { Metadata } from "next";
import { countyOfUats } from "@/lib/plans";
import { fmtDate, orgAdminPage } from "@/lib/guard";
import { officeActive, orgBlock, seatsUsed } from "@/lib/access";
import { activityByDay, members, pendingInvites, recentEvents, topTargets } from "@/lib/orgs";
import { AppShell } from "@/components/AppShell";
import { MembersPanel } from "@/components/forms";
import { LeaveRequests, OfficeHeader } from "@/components/AccountPanel";
import { leaveRequests } from "@/lib/office";
import { officeLinks } from "@/lib/links";
import { OfficePeople } from "@/components/OfficeLinks";
import { DayBars, EventLog, UatCountTable } from "@/components/Charts";

export const metadata: Metadata = { title: "Firma mea | UVALO" };
export const dynamic = "force-dynamic";

export default async function Firm({ searchParams }: { searchParams: Promise<{ nou?: string }> }) {
  const { db, c } = await orgAdminPage();
  const { nou } = await searchParams;
  const org = c.org!;
  const [m, inv, used, days, uats, events] = await Promise.all([
    members(db, org.id), pendingInvites(db, org.id), seatsUsed(db, org.id), activityByDay(db, 30, org.id), topTargets(db, 30, "uat_open", org.id), recentEvents(db, { orgId: org.id, limit: 50 }),
  ]);
  const block = orgBlock(org);
  // the office's people in one panel (members + associates), for now only for super-admins and offices with the function on
  const people = !!org.office_at && (c.super || officeActive(c));
  const [leaves, links] = await Promise.all([leaveRequests(db, org.id), people ? officeLinks(db, org.id) : Promise.resolve([])]);
  const logo = org.has_logo ? (await db.prepare("SELECT logo FROM orgs WHERE id = ?").bind(org.id).first<{ logo: string | null }>())?.logo ?? null : null;
  const countyOf = await countyOfUats();
  return (
    <AppShell c={c} active="firma" title={org.name} subtitle={`${org.seats} ${org.seats === 1 ? "loc" : "locuri"} în echipă`}>
      {block && <div className="note">{block}</div>}
      <OfficeHeader welcome={nou === "1"} canEdit={c.office}
        initial={{ name: org.name, corporate: !!org.corporate, corp_no: org.corp_no ?? "", description: org.description ?? "", logo }} />
      <LeaveRequests rows={leaves.map((l) => ({ id: l.id, name: l.name, email: l.email, legit: l.legit, tablou_name: l.tablou_name, created: fmtDate(l.created_at) }))} />
      {people ? (
        <OfficePeople seats={org.seats} used={used} canOwner={c.super || c.role === "owner"}
          people={m.map((x) => ({ user_id: x.user_id, email: x.email, name: x.name, status: x.status, role: x.role, anevar: !!x.anevar_no, has_av: !!x.has_avatar, last_seen: x.last_seen_at ? fmtDate(x.last_seen_at, true) : "—", me: x.user_id === c.user.id }))}
          invites={inv.map((i) => ({ id: i.id, email: i.email, role: i.role, created: fmtDate(i.created_at), expires: fmtDate(i.expires_at), by: i.invited_by_name }))}
          links={links.map((l) => ({ id: l.id, kind: l.kind, status: l.status, since: fmtDate(l.status === "active" ? l.decided_at ?? l.created_at : l.created_at),
            user_id: l.user_id, name: l.name, email: l.email, anevar_no: l.anevar_no, county: l.county, has_av: !!l.has_avatar }))} />
      ) : (
        <MembersPanel
          members={m.map((x) => ({ user_id: x.user_id, email: x.email, name: x.name, status: x.status, role: x.role, last_seen: x.last_seen_at ? fmtDate(x.last_seen_at, true) : "—", events_30: x.events_30, searches_30: x.searches_30, exports_30: x.exports_30, me: x.user_id === c.user.id, has_av: !!x.has_avatar }))}
          invites={inv.map((i) => ({ id: i.id, email: i.email, role: i.role, created: fmtDate(i.created_at), expires: fmtDate(i.expires_at), by: i.invited_by_name }))}
          seats={org.seats} used={used} canOwner={c.super || c.role === "owner"}
        />
      )}
      <div className="cols">
        <DayBars days={days} label="Activitatea firmei, ultimele 30 de zile" />
        <UatCountTable title="Localități folosite (30 de zile)" rows={uats} countyOf={countyOf} empty="Nicio localitate deschisă încă." />
      </div>
      <EventLog rows={events} showOrg={false} />
    </AppShell>
  );
}
