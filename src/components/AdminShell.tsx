import type { Ctx } from "@/lib/access";
import { initials } from "@/lib/guard";
import { LogoutButton } from "./ClientBits";

export type AdminKey = "panou" | "solicitari" | "tablou" | "utilizatori" | "firme" | "activitate";

/** VALUEFY administration portal: its own menu, separate from the tools the valuers use. */
export function AdminShell(props: { c: Ctx; active: AdminKey; pending?: number; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const { c } = props;
  const nav: [AdminKey, string, string][] = [
    ["panou", "Panou", "/admin"], ["solicitari", "Solicitări de cont", "/admin/solicitari"], ["tablou", "Tablou ANEVAR", "/admin/tablou"],
    ["utilizatori", "Utilizatori", "/admin/utilizatori"], ["firme", "Firme și abonamente", "/admin/firme"], ["activitate", "Activitate", "/admin/activitate"],
  ];
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brandPill">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/valuefy-logo.png" alt="VALUEFY" />
          </span>
          <span className="brandLabel">Tools · Admin</span>
        </div>
        <nav className="nav" aria-label="Administrare">
          {nav.map(([k, l, h]) => (
            <a key={k} href={h} aria-current={props.active === k ? "page" : undefined}>
              {l}{k === "solicitari" && !!props.pending && <span className="soon">{props.pending}</span>}
            </a>
          ))}
        </nav>
        <div className="me">
          <a className="sideLink" href="/">← Aplicația VALUEFY Tools</a>
          <div className="meCard">
            <span className="avatar">{initials(c.user.name, c.user.email)}</span>
            <span className="meText"><b>{c.user.name || c.user.email}</b><small>Administrator VALUEFY</small></span>
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
      <nav className="bottomNav" aria-label="Administrare">
        {nav.slice(0, 4).map(([k, l, h]) => <a key={k} href={h} aria-current={props.active === k ? "page" : undefined}>{l}</a>)}
      </nav>
    </div>
  );
}
