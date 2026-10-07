import type { Ctx } from "@/lib/access";
import { canManageOrg, ROLE_LABEL } from "@/lib/access";
import { initials } from "@/lib/guard";
import { LogoutButton, OrgSwitch } from "./ClientBits";

type Key = "home" | "localizare" | "firma" | "cont";

/** Sidebar layout (VALUEFY design), with the menu the person is entitled to. */
export function AppShell(props: { c: Ctx; active: Key; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const { c } = props;
  const nav: { key: Key; label: string; href: string; soon?: boolean }[] = [
    { key: "home", label: "Acasă", href: "/" },
    { key: "localizare", label: "Localizator cadastral", href: "/localizare" },
    ...(c.org && canManageOrg(c) ? [{ key: "firma" as const, label: "Firma mea", href: "/firma" }] : []),
    { key: "cont", label: "Contul meu", href: "/cont" },
  ];
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
        </nav>
        <div className="me">
          {c.super && <a className="sideLink" href="/admin">Portal admin →</a>}
          <OrgSwitch orgs={c.orgs.map((o) => ({ id: o.org_id, name: o.org_name }))} current={c.org?.id ?? null} />
          <div className="meCard">
            {c.user.has_avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className="avatar avatarImg" src={`/api/avatar/${c.user.id}`} alt="" />
              : <span className="avatar">{initials(c.user.name, c.user.email)}</span>}
            <span className="meText"><b>{c.user.name || c.user.email}</b><small>{sub}</small></span>
          </div>
          <LogoutButton />
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
        {nav.slice(0, 4).map((i) => (
          <a key={i.key} href={i.href} aria-current={props.active === i.key ? "page" : undefined}>{i.label}</a>
        ))}
      </nav>
    </div>
  );
}
