import type { Ctx } from "@/lib/access";
import { canManageOrg, ROLE_LABEL } from "@/lib/access";
import { initials } from "@/lib/guard";
import { LogoutButton, OrgSwitch } from "./ClientBits";
import { Referral } from "./Referral";

type Key = "home" | "localizare" | "firma" | "cont";

/** Sidebar layout (VALUEFY design), with the menu the person is entitled to. */
export function AppShell(props: { c: Ctx; active: Key; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const { c } = props;
  const nav: { key: Key; label: string; href: string; soon?: boolean }[] = [
    { key: "home", label: "Acasă", href: "/" },
    { key: "localizare", label: "Localizator cadastral", href: "/localizare" },
    // "Firma mea" only for those who turned on "Lucrez ca birou de evaluare" in their account.
    ...(c.org && canManageOrg(c) && c.user.is_office ? [{ key: "firma" as const, label: "Firma mea", href: "/firma" }] : []),
  ];
  // On the phone the account is in the bottom menu; on the computer it opens from the profile card.
  const mobileNav = [...nav, { key: "cont" as const, label: "Contul meu", href: "/cont" }];
  const sub = c.user.anevar_no ? `Legitimație ANEVAR ${c.user.anevar_no}` : c.org ? `${c.org.name} · ${c.role ? ROLE_LABEL[c.role] : ""}` : c.super ? "Administrator VALUEFY" : c.user.email;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brandPill">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/valuefy-logo.png" alt="VALUEFY" />
          </span>
          <span className="brandLabel">Tools</span>
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
          <div className="meRow">
            <a className="meBtn" href="/cont" aria-current={props.active === "cont" ? "page" : undefined}>Contul meu</a>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="main">
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
        {mobileNav.slice(0, 4).map((i) => (
          <a key={i.key} href={i.href} aria-current={props.active === i.key ? "page" : undefined}>{i.label}</a>
        ))}
      </nav>
    </div>
  );
}
