import type { Ctx } from "@/lib/access";
import { maintenanceOn } from "@/lib/maintenance";
import { initials } from "@/lib/guard";
import { getDb } from "@/lib/db";
import { FilterFold, LogoutButton, MenuButton } from "./ClientBits";


/** The bottom menu on the phone: short labels and icons (Lucide-like paths). */
const MOBILE: [AdminKey, string, string][] = [["panou", "Panou", "/admin"], ["utilizatori", "Conturi", "/admin/utilizatori"], ["activitate", "Activitate", "/admin/activitate"], ["solicitari", "Solicitări", "/admin/solicitari"]];
const ICONS: Partial<Record<AdminKey, string>> = {
  panou: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  utilizatori: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  activitate: "M22 12h-4l-3 9L9 3l-3 9H2",
  solicitari: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
};

export type AdminKey = "panou" | "solicitari" | "recomandari" | "tablou" | "utilizatori" | "firme" | "activitate" | "instrumente" | "feedback";

/** UVALO administration portal: its own menu, separate from the tools the valuers use. */
export async function AdminShell(props: { c: Ctx; active: AdminKey; pending?: number; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const mnt = await maintenanceOn();
  const { c } = props;
  // new feedback messages, next to "Feedback" in the menu
  const db = await getDb();
  const fb = db ? (await db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = 'nou'").first<{ n: number }>().catch(() => null))?.n ?? 0 : 0;
  const nav: [AdminKey, string, string][] = [
    ["panou", "Panou", "/admin"], ["solicitari", "Solicitări de cont", "/admin/solicitari"], ["recomandari", "Recomandări", "/admin/recomandari"], ["tablou", "Tablou ANEVAR", "/admin/tablou"],
    ["utilizatori", "Utilizatori", "/admin/utilizatori"], ["firme", "Firme și abonamente", "/admin/firme"], ["activitate", "Activitate", "/admin/activitate"], ["instrumente", "Instrumente", "/admin/instrumente"], ["feedback", "Feedback", "/admin/feedback"],
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
              {l}{k === "solicitari" && !!props.pending && <span className="soon">{props.pending}</span>}{k === "feedback" && fb > 0 && <span className="soon">{fb}</span>}
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
      {/* on the phone (and in the installed "UVALO Admin"): the four most used pages with icons, the rest in "Meniu" */}
      <nav className="bottomNav admNav" aria-label="Administrare">
        {MOBILE.map(([k, l, h]) => {
          const n = k === "solicitari" ? props.pending ?? 0 : k === "feedback" ? fb : 0;
          return (
            <a key={k} href={h} aria-current={props.active === k ? "page" : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[k]} /></svg>
              {l}{n > 0 && <span className="admNavN">{n}</span>}
            </a>
          );
        })}
        <MenuButton />
      </nav>
      <script src="/presence.js" async />
      {/* phone: the filter forms (Utilizatori, Tablou) show only the search; the rest behind "Mai multe filtre" */}
      <FilterFold />
    </div>
  );
}
