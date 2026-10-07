import type { Metadata } from "next";
import { fmtDate, page } from "@/lib/guard";
import { device } from "@/lib/ua";
import { recentEvents } from "@/lib/orgs";
import { AppShell } from "@/components/AppShell";
import { ProfileForm, SessionsList } from "@/components/forms";
import { EventLog } from "@/components/Charts";

export const metadata: Metadata = { title: "Contul meu | VALUEFY Tools" };
export const dynamic = "force-dynamic";

export default async function Account() {
  const { db, c } = await page();
  const { results } = await db
    .prepare("SELECT id, user_agent, ip, country, city, created_at, last_seen_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC")
    .bind(c.user.id, new Date().toISOString())
    .all<{ id: string; user_agent: string | null; ip: string | null; country: string | null; city: string | null; created_at: string; last_seen_at: string | null }>();
  const events = await recentEvents(db, { userId: c.user.id, limit: 30 });
  return (
    <AppShell c={c} active="cont" title="Contul meu" subtitle={c.user.email}>
      <div className="cols">
        <ProfileForm name={c.user.name} phone={c.user.phone ?? ""} anevar={c.user.anevar_no ?? ""} email={c.user.email} />
        <SessionsList rows={results.map((s) => ({
          id: s.id, device: device(s.user_agent), place: [s.city, s.country].filter(Boolean).join(", ") || s.ip || "locație necunoscută",
          created: fmtDate(s.created_at, true), seen: fmtDate(s.last_seen_at, true), current: s.id === c.session.id,
        }))} />
      </div>
      <EventLog rows={events} showOrg={c.orgs.length > 1} showUser={false} />
    </AppShell>
  );
}
