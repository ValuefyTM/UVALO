import type { Ctx } from "@/lib/access";
import { maintenanceOn } from "@/lib/maintenance";
import { officeActive, ROLE_LABEL } from "@/lib/access";
import { initials } from "@/lib/guard";
import { getDb } from "@/lib/db";
import { relevantCount } from "@/lib/collab";
import { LogoutButton, MenuButton, OrgSwitch } from "./ClientBits";
import { Referral } from "./Referral";

type Key = "home" | "instrumente" | "colaborari" | "inspectii" | "localizare" | "amplasament" | "comparabile" | "word" | "chrome" | "firma" | "cont";
// the tools' own pages light up "Instrumente" in the menu
const TOOL_KEYS: Key[] = ["instrumente", "localizare", "amplasament", "comparabile", "word", "chrome"];

type Ico = "home" | "insp" | "collab" | "tools" | "chart";
const ICO: Record<Ico, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  insp: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  collab: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" /><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.8c1.9.7 3 2.6 3 5.2" /></>,
  tools: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  chart: <path d="M4 20h16M7 16v-4M12 16V7M17 16v-6" />,
};
const NavIcon = ({ k }: { k: Ico }) => <svg className="navIco" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICO[k]}</svg>;

/** Sidebar layout (UVALO design): Acasă, Instrumente (all the tools on one page), În curând. */
export async function AppShell(props: { c: Ctx; active: Key; title: string; subtitle?: string; actions?: React.ReactNode; dark?: boolean; children: React.ReactNode }) {
  const mnt = props.c.super ? await maintenanceOn() : false;
  const { c } = props;
  // Colaborări: the posts in this person's zones they have not answered yet, next to the menu item
  // (not activated yet: a "NOU" label instead)
  let collabN = 0, collabNew = false;
  if (c.modules.includes("colaborari")) {
    const db = await getDb();
    collabNew = !!db && !(await db.prepare("SELECT 1 FROM collab_profiles WHERE user_id = ?").bind(c.user.id).first().catch(() => true));
    collabN = db && !collabNew ? await relevantCount(db, c.user.id).catch(() => 0) : 0;
  }
  // Inspecții: the person's inspections for today that are not finished yet (gold count next to the menu item)
  let inspN = 0;
  if (c.modules.includes("inspectii")) {
    const db = await getDb();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
    inspN = db ? ((await db.prepare("SELECT COUNT(*) AS n FROM inspections WHERE assignee_id = ? AND deleted_at IS NULL AND status IN ('plan', 'lucru') AND substr(scheduled_at, 1, 10) = ?")
      .bind(c.user.id, today).first<{ n: number }>().catch(() => null))?.n ?? 0) : 0;
  }
  // Inspecții: 2nd in the menu once launched (mode Activ); until then under "În curând" (a link with TEST for those allowed in the test)
  const inspLive = c.insp === "on" && c.modules.includes("inspectii");
  const nav: { key: Key; label: string; href: string; icon: Ico; count?: number; gold?: boolean; isNew?: boolean; test?: boolean }[] = [
    { key: "home", label: "Acasă", href: "/", icon: "home" },
    ...(inspLive ? [{ key: "inspectii" as const, label: "Inspecții", href: "/inspectii", icon: "insp" as const, count: inspN, gold: true }] : []),
    // Colaborări: only for those allowed in its current mode (Test: the chosen people; Activ: everyone).
    ...(c.modules.includes("colaborari") ? [{ key: "colaborari" as const, label: "Colaborări", href: "/colaborari", icon: "collab" as const, count: collabN, isNew: collabNew }] : []),
    { key: "instrumente", label: "Instrumente", href: "/instrumente", icon: "tools" },
  ];
  const inspTest = !inspLive && c.modules.includes("inspectii");
  const current = (k: Key) => (k === "instrumente" ? TOOL_KEYS.includes(props.active) : props.active === k) ? "page" as const : undefined;
  // Phone: Acasă, Instrumente, Colaborări (when open to this person) and the account in the bottom menu; the rest behind "Meniu".
  const mobileNav = [...nav.filter((i) => i.key !== "firma"), { key: "cont" as const, label: "Contul meu", href: "/cont" }].slice(0, 4);
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
            <a key={i.key} className="navI" href={i.href} aria-current={current(i.key)}>
              <NavIcon k={i.icon} />
              <span className="navLbl">{i.label}</span>
              {i.isNew && <span className="navNew">NOU</span>}
              {i.test && <span className="navNew navTest">TEST</span>}
              {!!i.count && i.gold && <span className="navCount gold" aria-label={`${i.count} ${i.count === 1 ? "inspecție" : "inspecții"} azi`} title={`${i.count === 1 ? "O inspecție" : `${i.count} inspecții`} de făcut azi`}>{i.count > 99 ? "99+" : i.count}</span>}
              {!!i.count && !i.gold && <span className="navCount" aria-label={`${i.count} ${i.count === 1 ? "anunț activ" : "anunțuri active"} în zonele tale`} title={`${i.count === 1 ? "Un anunț activ" : `${i.count} anunțuri active`} în zonele tale`}>{i.count > 99 ? "99+" : i.count}</span>}
            </a>
          ))}
          <span className="navSec">În curând</span>
          {inspTest
            ? <a className="navI navSoonOn" href="/inspectii" aria-current={current("inspectii")}><NavIcon k="insp" /><span className="navLbl">Inspecții</span>{!!inspN && <span className="navCount gold">{inspN}</span>}<span className="navNew navTest">TEST</span></a>
            : !inspLive && <a aria-disabled="true" tabIndex={-1} className="navI navSoon"><NavIcon k="insp" /><span className="navLbl">Inspecții</span></a>}
          <a aria-disabled="true" tabIndex={-1} className="navI navSoon"><NavIcon k="chart" /><span className="navLbl">Analize de piață</span></a>
          {!c.modules.includes("colaborari") && c.collab !== "on" && !!c.user.anevar_no?.trim() && <a aria-disabled="true" tabIndex={-1} className="navI navSoon"><NavIcon k="collab" /><span className="navLbl">Colaborări</span></a>}
        </nav>
        <div className="me">
          {c.super && <a className="sideLink" href="/admin">Portal admin →</a>}
          <OrgSwitch orgs={c.orgs.map((o) => ({ id: o.org_id, name: o.org_name }))} current={c.org?.id ?? null} />
          <Referral />
          <div className={`meStack${officeActive(c) ? " withOffice" : ""}`}>
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
          {/* "Birou de evaluare": the office under the profile, in the same card (not in the menu) */}
          {officeActive(c) && (
            <a className="meOffice" href="/firma" aria-current={props.active === "firma" ? "page" : undefined} title="Firma mea: colegii din birou, detaliile firmei, activitatea echipei">
              {c.org!.has_logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="meOfficeLogo" src={`/api/org/logo/${c.org!.id}`} alt="" />
                : <span className="meOfficeLogo" aria-hidden="true">{c.org!.name.slice(0, 2).toUpperCase()}</span>}
              <span className="meText"><b>Firma mea</b><small>{c.org!.name}</small></span>
              <span className="meGo" aria-hidden="true">→</span>
            </a>
          )}
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="main">
        {mnt && <div className="mntStrip">Mentenanță pornită: utilizatorii văd pagina „Revenim în curând”. Doar administratorii UVALO văd platforma. <a href="/admin">Oprește din Admin → Panou</a></div>}
        <header className={props.dark ? "top topDark" : "top"}>
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
          <a key={i.key} href={i.href} aria-current={current(i.key)}>
            {i.label}
            {"count" in i && !!i.count && <span className="navDot" aria-label={`${i.count} în zonele tale`}>{i.count > 99 ? "99+" : i.count}</span>}
            {"isNew" in i && i.isNew && <span className="navDot new">NOU</span>}
          </a>
        ))}
        <MenuButton />
      </nav>
      {/* feedback button, bottom right (above the bottom menu on phones) */}
      <script src="/feedback.js" async data-bottom="16" data-bottom-mobile="84" />
      <script src="/presence.js" async />
    </div>
  );
}
