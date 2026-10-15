import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { context } from "@/lib/access";
import { DEFAULT_MESSAGE, maintenance } from "@/lib/maintenance";
import { LogoutButton } from "@/components/ClientBits";

export const metadata: Metadata = { title: "Revenim în curând | UVALO" };
export const dynamic = "force-dynamic";

/** What people see while the platform is in maintenance (Admin → Panou → Mod mentenanță). */
export default async function Maintenance({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const preview = (await searchParams).preview === "1";
  const db = await getDb();
  const m = db ? await maintenance(db) : { on: false, message: "" };
  const c = db ? await context(db) : null;
  // administrators get through; with ?preview=1 they see the page as people do
  if (!(c?.super && preview) && (!m.on || c?.super)) redirect("/");
  // an office invitation waiting: it can be answered during maintenance too (in "Contul meu")
  const inv = c && db ? await db.prepare(`SELECT o.name FROM office_links l JOIN orgs o ON o.id = l.org_id WHERE l.user_id = ? AND l.status = 'invited' ORDER BY l.created_at DESC LIMIT 1`)
    .bind(c.user.id).first<{ name: string }>() : null;
  return (
    <div className="mntPage">
      <div className="mntBox">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/uvalo-logo.svg" alt="UVALO" className="mntLogo" />
        <span className="mntEyebrow">Mentenanță</span>
        <h1>Revenim în curând</h1>
        <p>{m.message || DEFAULT_MESSAGE}</p>
        <p className="mntSmall">Datele și contul tău sunt în siguranță. Pentru întrebări, scrie-ne la <a href="mailto:office@uvalo.ro">office@uvalo.ro</a>.</p>
        {inv && <p className="mntInv"><b>{inv.name}</b> te-a invitat să te asociezi cu biroul. <a href="/cont#asocieri">Vezi invitația →</a></p>}
        <div className="mntActions">
          {c ? <LogoutButton /> : <a className="mntLink" href="/login">Administrator? Intră în cont →</a>}
        </div>
      </div>
    </div>
  );
}
