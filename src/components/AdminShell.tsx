import type { Ctx } from "@/lib/access";
import { maintenanceOn } from "@/lib/maintenance";
import { initials } from "@/lib/guard";
import { LogoutButton, MenuButton } from "./ClientBits";

export type AdminKey = "panou" | "solicitari" | "recomandari" | "tablou" | "utilizatori" | "firme" | "activitate" | "planuri";

/** VALUEFY administration portal: its own menu, separate from the tools the valuers use. */
export async function AdminShell(props: { c: Ctx; active: AdminKey; pending?: number; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const mnt = await maintenanceOn();
  const { c } = props;
  const nav: [AdminKey, string, string][] = [
    ["panou", "Panou", "/admin"], ["solicitari", "Solicitări de cont", "/admin/solicitari"], ["recomandari", "Recomandări", "/admin/recomandari"], ["tablou", "Tablou ANEVAR", "/admin/tablou"],
    ["utilizatori", "Utilizatori", "/admin/utilizatori"], ["firme", "Firme și abonamente", "/admin/firme"], ["activitate", "Activitate", "/admin/activitate"], ["planuri", "Planuri cadastrale", "/admin/planuri"],
  ];
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <a href="/" className="brandLogo" aria-label="UVALO">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/uvalo-logo.svg" alt="UVALO" />
          </a>
          <span className="brandLabel">Admin</span>
        </div>
        <nav className="nav" aria-label="Administrare">
          {nav.map(([k, l, h]) => (
            <a key={k} href={h} aria-current={props.active === k ? "page" : undefined}>
              {l}{k === "solicitari" && !!props.pending && <span className="soon">{props.pending}</span>}
            </a>
          ))}
        </nav>
        <div className="me">
          <a className="sideLink" href="/">← Aplicația UVALO</a>
          <div className="meCard">
            <span className="avatar">{initials(c.user.name, c.user.email)}</span>
            <span className="meText"><b>{c.user.name || c.user.email}</b><small>Administrator UVALO</small></span>
          </div>
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
      <nav className="bottomNav" aria-label="Administrare">
        {nav.slice(0, 3).map(([k, l, h]) => <a key={k} href={h} aria-current={props.active === k ? "page" : undefined}>{l}</a>)}
        <MenuButton />
      </nav>
    </div>
  );
}
