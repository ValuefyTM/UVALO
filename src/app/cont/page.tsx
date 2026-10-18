import type { Metadata } from "next";
import { fmtDate, initials, page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { AccountPanel, CloseAccount, NewsletterCard, OfficeCard } from "@/components/AccountPanel";
import { CLOSE_REASONS } from "@/lib/merge";
import { canManageOrg, officeActive } from "@/lib/access";
import { pendingLeave } from "@/lib/office";
import { myLinks } from "@/lib/links";
import { MyLinks } from "@/components/OfficeLinks";
import { ClaudeCard } from "@/components/ClaudeCard";
import { origin } from "@/lib/site";

export const metadata: Metadata = { title: "Contul meu | UVALO" };
export const dynamic = "force-dynamic";

export default async function Account() {
  // works during maintenance too: office invitations are accepted here
  const { db, c } = await page({ maint: true });
  const u = c.user;
  const m = u.anevar_no ? await db.prepare("SELECT name, county, specs, tablou_date FROM anevar_members WHERE legit = ?").bind(u.anevar_no).first<{ name: string; county: string | null; specs: string | null; tablou_date: string | null }>() : null;
  // "Birou de evaluare": the firm this person runs (its details prefill the activation form)
  const own = !!c.org && canManageOrg(c);
  const logo = own && c.org!.has_logo ? (await db.prepare("SELECT logo FROM orgs WHERE id = ?").bind(c.org!.id).first<{ logo: string | null }>())?.logo ?? null : null;
  const pl = c.org && !own ? await pendingLeave(db, u.id, c.org.id) : null;
  // asocieri with offices: only valuers; asking an office is open to the testers of the office function for now
  const links = u.anevar_no ? await myLinks(db, u.id) : [];
  const asked = !c.office && !!(await db.prepare("SELECT 1 FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify' AND target = 'birou' LIMIT 1").bind(u.id).first());
  return (
    <AppShell c={c} active="cont" title="Contul meu">
      <div style={{ maxWidth: 760 }}>
        <AccountPanel id={u.id} name={m?.name ?? u.name} email={u.email} legit={u.anevar_no} county={m?.county ?? u.county} specs={m?.specs ?? u.specs}
          hasAvatar={!!u.has_avatar} phone={u.phone} initials={initials(u.name, u.email)} tablou={m?.tablou_date ? fmtDate(m.tablou_date) : null} />
        <div style={{ height: 18 }} />
        <OfficeCard allowed={c.office} active={officeActive(c)} asked={asked} member={c.org && !canManageOrg(c) ? c.org.name : null}
          initial={{ name: own ? c.org!.name : "", corporate: own ? !!c.org!.corporate : false, corp_no: own ? c.org!.corp_no ?? "" : "", description: own ? c.org!.description ?? "" : "", logo }}
          leave={{ pending: pl ? fmtDate(pl.created_at) : null, legit: u.anevar_no }} />
        {u.anevar_no && (links.length > 0 || c.office) && <><div style={{ height: 18 }} />
          <MyLinks canRequest={c.office} rows={links.map((l) => ({ id: l.id, kind: l.kind, status: l.status, since: fmtDate(l.status === "active" || l.status === "ended" ? l.decided_at ?? l.created_at : l.created_at),
            ended: l.ended_at ? fmtDate(l.ended_at) : null, org_id: l.org_id, org_name: l.org_name, corp_no: l.corp_no, has_logo: !!l.has_logo }))} /></>}
        <div style={{ height: 18 }} />
        {(c.super || c.modules.includes("localizare")) && <><ClaudeCard app={await origin()} /><div style={{ height: 18 }} /></>}
        <NewsletterCard on={!!(await db.prepare("SELECT newsletter FROM users WHERE id = ?").bind(u.id).first<{ newsletter: number }>())?.newsletter} />
        <div style={{ height: 18 }} />
        <CloseAccount email={u.email} reasons={CLOSE_REASONS} />
      </div>
    </AppShell>
  );
}
