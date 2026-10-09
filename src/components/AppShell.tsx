import type { Ctx } from "@/lib/access";
import { maintenanceOn } from "@/lib/maintenance";
import { canManageOrg, OFFICE_READY, ROLE_LABEL } from "@/lib/access";
import { initials } from "@/lib/guard";
import { LogoutButton, MenuButton, OrgSwitch } from "./ClientBits";
import { Referral } from "./Referral";

type Key = "home" | "localizare" | "firma" | "cont";

/** Sidebar layout (VALUEFY design), with the menu the person is entitled to. */
export async function AppShell(props: { c: Ctx; active: Key; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const mnt = props.c.super ? await maintenanceOn() : false;
  const { c } = props;
  const nav: { key: Key; label: string; href: string; soon?: boolean }[] = [
    { key: "home", label: "Acasă", href: "/" },
    { key: "localizare", label: "Localizator cadastral", href: "/localizare" },
    // "Firma mea" only for those who turned on "Lucrez ca birou de evaluare" in their account.
    ...(OFFICE_READY && c.org && canManageOrg(c) && c.user.is_office ? [{ key: "firma" as const, label: "Firma mea", href: "/firma" }] : []),
  ];
  // Phone: the main pages in the bottom menu, the rest (account, sign out…) behind "Meniu", the sidebar as a panel.
  const mobileNav = [...nav, { key: "cont" as const, label: "Contul meu", href: "/cont" }].slice(0, 3);
  const sub = c.user.anevar_no ? `Legitimație ANEVAR ${c.user.anevar_no}` : c.org ? `${c.org.name} · ${c.role ? ROLE_LABEL[c.role] : ""}` : c.super ? "Administrator UVALO" : c.user.email;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <a href="/" className="brandLogo" aria-label="UVALO">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/uvalo-logo.svg" alt="UVALO" />
          </a>
        </div>
        <nav className="nav" aria-label="Meniu">
          {nav.map((i) => (
            <a key={i.key} href={i.href} aria-current={props.active === i.key ? "page" : undefined}>{i.label}</a>
          ))}
          <a aria-disabled="true" tabIndex={-1} style={{ opacity: 0.6, cursor: "default" }}>Analize de piață <span className="soon">în curând</span></a>
          <a aria-disabled="true" tabIndex={-1} style={{ opacity: 0.6, cursor: "default" }}>Colaborări <span className="soon">în curând</span></a>
        </nav>
        <div className="me">
          {c.super && <a className="sideLink" href="/admin">Portal admin →</a>}
          <OrgSwitch orgs={c.orgs.map((o) => ({ id: o.org_id, name: o.org_name }))} current={c.org?.id ?? null} />
          <Referral />
          <a className="meCard meLink" href="/cont" aria-current={props.active === "cont" ? "page" : undefined} title="Contul meu: imagine, email, birou de evaluare">
            {c.user.has_avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className="avatar avatarImg" src={`/api/avatar/${c.user.id}`} alt="" />
              : <span className="avatar">{initials(c.user.name, c.user.email)}</span>}
            <span className="meText"><b>{c.user.name || c.user.email}</b><small>{sub}</small></span>
            <span className="meGear" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
            </span>
          </a>
          <LogoutButton />
        </div>
      </aside>
      <div className="main">
        {mnt && <div className="mntStrip">Mentenanță pornită: utilizatorii văd pagina „Revenim în curând”. Doar administratorii UVALO văd platforma. <a href="/admin">Oprește din Admin → Panou</a></div>}
        <header className="top">
          <div>
            <h1>{props.title}</h1>
            {props.subtitle && <p>{props.subtitle}</p>}
          </div>
          {props.actions && <div className="actions">{props.actions}</div>}
        </header>
        <main className="content">{props.children}</main>
      </div>
      <nav className="bottomNav" aria-label="Meniu">
        {mobileNav.map((i) => (
          <a key={i.key} href={i.href} aria-current={props.active === i.key ? "page" : undefined}>{i.label}</a>
        ))}
        <MenuButton />
      </nav>
    </div>
  );
}
