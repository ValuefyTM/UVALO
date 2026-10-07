import type { Metadata } from "next";
import { fmtDate, initials, page } from "@/lib/guard";
import { AppShell } from "@/components/AppShell";
import { AccountPanel, OfficeToggle } from "@/components/AccountPanel";
import { canManageOrg } from "@/lib/access";

export const metadata: Metadata = { title: "Contul meu | VALUEFY Tools" };
export const dynamic = "force-dynamic";

export default async function Account() {
  const { db, c } = await page();
  const u = c.user;
  const m = u.anevar_no ? await db.prepare("SELECT name, county, specs, tablou_date FROM anevar_members WHERE legit = ?").bind(u.anevar_no).first<{ name: string; county: string | null; specs: string | null; tablou_date: string | null }>() : null;
  return (
    <AppShell c={c} active="cont" title="Contul meu">
      <div style={{ maxWidth: 760 }}>
        <AccountPanel id={u.id} name={m?.name ?? u.name} email={u.email} legit={u.anevar_no} county={m?.county ?? u.county} specs={m?.specs ?? u.specs}
          hasAvatar={!!u.has_avatar} initials={initials(u.name, u.email)} tablou={m?.tablou_date ? fmtDate(m.tablou_date) : null} />
        <div style={{ height: 18 }} />
        <OfficeToggle on={!!u.is_office} can={!!c.org && canManageOrg(c)} org={c.org?.name ?? null} />
      </div>
    </AppShell>
  );
}
