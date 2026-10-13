import type { Metadata } from "next";
import { fmtDate, initials, page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { AccountPanel, CloseAccount, OfficeCard } from "@/components/AccountPanel";
import { CLOSE_REASONS } from "@/lib/merge";
import { canManageOrg, officeActive } from "@/lib/access";

export const metadata: Metadata = { title: "Contul meu | UVALO" };
export const dynamic = "force-dynamic";

export default async function Account() {
  const { db, c } = await page();
  const u = c.user;
  const m = u.anevar_no ? await db.prepare("SELECT name, county, specs, tablou_date FROM anevar_members WHERE legit = ?").bind(u.anevar_no).first<{ name: string; county: string | null; specs: string | null; tablou_date: string | null }>() : null;
  // "Birou de evaluare": the firm this person runs (its details prefill the activation form)
  const own = !!c.org && canManageOrg(c);
  const logo = own && c.org!.has_logo ? (await db.prepare("SELECT logo FROM orgs WHERE id = ?").bind(c.org!.id).first<{ logo: string | null }>())?.logo ?? null : null;
  const asked = !c.office && !!(await db.prepare("SELECT 1 FROM events WHERE user_id = ? AND module = 'home' AND action = 'notify' AND target = 'birou' LIMIT 1").bind(u.id).first());
  return (
    <AppShell c={c} active="cont" title="Contul meu">
      <div style={{ maxWidth: 760 }}>
        <AccountPanel id={u.id} name={m?.name ?? u.name} email={u.email} legit={u.anevar_no} county={m?.county ?? u.county} specs={m?.specs ?? u.specs}
          hasAvatar={!!u.has_avatar} initials={initials(u.name, u.email)} tablou={m?.tablou_date ? fmtDate(m.tablou_date) : null} />
        <div style={{ height: 18 }} />
        <OfficeCard allowed={c.office} active={officeActive(c)} asked={asked} member={c.org && !canManageOrg(c) ? c.org.name : null}
          initial={{ name: own ? c.org!.name : "", corporate: own ? !!c.org!.corporate : false, corp_no: own ? c.org!.corp_no ?? "" : "", description: own ? c.org!.description ?? "" : "", logo }} />
        <div style={{ height: 18 }} />
        <CloseAccount email={u.email} reasons={CLOSE_REASONS} />
      </div>
    </AppShell>
  );
}
