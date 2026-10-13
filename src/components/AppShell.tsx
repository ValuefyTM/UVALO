import type { Ctx } from "@/lib/access";
import { maintenanceOn } from "@/lib/maintenance";
import { officeActive, ROLE_LABEL } from "@/lib/access";
import { initials } from "@/lib/guard";
import { getDb } from "@/lib/db";
import { relevantCount } from "@/lib/collab";
import { LogoutButton, MenuButton, OrgSwitch } from "./ClientBits";
import { Referral } from "./Referral";

type Key = "home" | "instrumente" | "colaborari" | "localizare" | "amplasament" | "comparabile" | "word" | "chrome" | "firma" | "cont";
// the tools' own pages light up "Instrumente" in the menu
const TOOL_KEYS: Key[] = ["instrumente", "localizare", "amplasament", "comparabile", "word", "chrome"];

/** Sidebar layout (UVALO design): Acasă, Instrumente (all the tools on one page), În curând. */
export async function AppShell(props: { c: Ctx; active: Key; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
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
  const nav: { key: Key; label: string; href: string; count?: number; isNew?: boolean }[] = [
    { key: "home", label: "Acasă", href: "/" },
    { key: "instrumente", label: "Instrumente", href: "/instrumente" },
    // Colaborări: only for those allowed in its current mode (Test: the chosen people; Activ: everyone).
    ...(c.modules.includes("colaborari") ? [{ key: "colaborari" as const, label: "Colaborări", href: "/colaborari", count: collabN, isNew: collabNew }] : []),
  ];
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
            <a key={i.key} href={i.href} aria-current={current(i.key)}>
              {i.label}
              {i.isNew && <span className="navNew">NOU</span>}
              {!!i.count && <span className="navCount" aria-label={`${i.count} ${i.count === 1 ? "anunț activ" : "anunțuri active"} în zonele tale`} title={`${i.count === 1 ? "Un anunț activ" : `${i.count} anunțuri active`} în zonele tale`}>{i.count > 99 ? "99+" : i.count}</span>}
            </a>
          ))}
          <span className="navSec">În curând</span>
          <a aria-disabled="true" tabIndex={-1} className="navSoon">Analize de piață</a>
          {!c.modules.includes("colaborari") && c.collab !== "on" && !!c.user.anevar_no?.trim() && <a aria-disabled="true" tabIndex={-1} className="navSoon">Colaborări</a>}
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
