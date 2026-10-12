import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmtDate, superPage } from "@/lib/guard";
import { countyOfUats, githubReady, listUploads, refresh, uats } from "@/lib/plans";
import { recentEvents } from "@/lib/orgs";
import { aiTotals, aiUsage, FEATURES, userLimits, PROMPT_DEFAULTS, PROMPT_LABELS, type PromptKey, prompts, toolByKey, toolSettings, toolUsage } from "@/lib/tools";
import { roDate } from "@/lib/plan-format";
import { AdminShell } from "@/components/AdminShell";
import { AiLimits, CollabAdmin, FeatureSwitches, PromptEditor, ToolSwitch, UserLimits } from "@/components/admin";
import { collabCounts, collabSettings, testUsers } from "@/lib/collab";
import { CountTable, UatCountTable } from "@/components/Charts";
import { PlanList, PlanUploader } from "@/components/plans";
import { ToolAnalytics } from "@/components/ToolAnalytics";

export const metadata: Metadata = { title: "Instrument | UVALO Admin" };
export const dynamic = "force-dynamic";

/** Settings and usage of one tool: on/off, its statistics and what belongs to it (plans, AI prompts and limits). */
export default async function Instrument({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const tool = toolByKey(key);
  if (!tool) notFound();
  const { db, c, pending } = await superPage();
  const [{ off, limits }, u, events] = await Promise.all([toolSettings(db), toolUsage(db, key, 30, key === "localizare" ? ["parcel", "search"] : ["analysis"]), recentEvents(db, { module: key, limit: 40 })]);
  const switchCard = <ToolSwitch k={key} name={tool.name} on={!off.includes(key)} />;

  if (key === "localizare") {
    await refresh(db).catch(() => null);
    const [list, uploads, ready, countyOf] = await Promise.all([uats(new Request("https://tools.local/")), listUploads(db), githubReady(), countyOfUats()]);
    const counties = new Set(list.map((x) => x.county)).size;
    const parcels = list.reduce((s, x) => s + x.n, 0);
    const opened = u.targets.filter((t) => /^\d/.test(t.target));
    const uatsOpened = await db.prepare(`SELECT target, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM events WHERE module = 'localizare' AND action = 'uat_open' AND at > ? AND target IS NOT NULL GROUP BY target ORDER BY n DESC LIMIT 15`)
      .bind(new Date(Date.now() - 30 * 864e5).toISOString()).all<{ target: string; n: number; u: number }>();
    return (
      <AdminShell c={c} active="instrumente" pending={pending} title={tool.name} subtitle={`${counties === 1 ? "1 județ" : `${counties} județe`} · ${list.length} UAT-uri · ${parcels.toLocaleString("ro-RO")} imobile`}
        actions={<a className="btn btnGhost btnSm" href="/admin/instrumente">← Instrumente</a>}>
        {switchCard}
        <h2 className="secTitle">Statistici</h2>
        <ToolAnalytics u={u} events={events} />
        <UatCountTable title="Localități deschise (30 de zile)" rows={uatsOpened.results} countyOf={countyOf} empty="—" />
        <CountTable title="Parcele căutate cel mai des (30 de zile)" rows={opened.map((t) => [t.target, t.n, t.u])} head={["Nr. cadastral", "De câte ori", "Persoane"]} empty="—" />
        <h2 className="secTitle" id="planuri">Planuri cadastrale</h2>
        <div className="cols">
          <PlanUploader uats={list} ready={ready} />
          <PlanList initial={uploads} />
        </div>
        <section className="card">
          <h2>UAT-uri în localizator</h2>
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>UAT</th><th>Imobile</th><th>Construcții</th><th>Date cadastrale la</th></tr></thead>
              {[...new Set(list.map((x) => x.county))].map((county) => {
                const rows = list.filter((x) => x.county === county);
                return (
                  <tbody key={county}>
                    <tr className="groupRow"><td>Județul {county} · {rows.length} UAT-uri</td><td>{rows.reduce((s, x) => s + x.n, 0).toLocaleString("ro-RO")}</td><td>{rows.reduce((s, x) => s + (x.nb ?? 0), 0).toLocaleString("ro-RO")}</td><td /></tr>
                    {rows.map((x) => (
                      <tr key={x.key}><td><b>{x.name}</b></td><td>{x.n.toLocaleString("ro-RO")}</td><td>{(x.nb ?? 0).toLocaleString("ro-RO")}</td><td>{x.date ? roDate(x.date) : <span className="muted">plan DWG inițial</span>}</td></tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        </section>
      </AdminShell>
    );
  }

  if (key === "amplasament") {
    const [P, ai, totals, exc] = await Promise.all([prompts(db), aiUsage(db), aiTotals(db), userLimits(db)]);
    const ids = Object.keys(exc);
    const people = ids.length ? (await db.prepare(`SELECT id, COALESCE(NULLIF(name, ''), email) AS name, email FROM users WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ id: string; name: string; email: string }>()).results : [];
    const excRows = people.map((p) => ({ ...p, ...exc[p.id] })).sort((x, y) => x.name.localeCompare(y.name, "ro"));
    const items = (Object.keys(PROMPT_DEFAULTS) as PromptKey[]).map((k) => ({ key: k, ...PROMPT_LABELS[k], value: P[k], def: PROMPT_DEFAULTS[k] }));
    return (
      <AdminShell c={c} active="instrumente" pending={pending} title={tool.name} subtitle="Statistici, prompturile AI și limitele" actions={<a className="btn btnGhost btnSm" href="/admin/instrumente">← Instrumente</a>}>
        {switchCard}
        <h2 className="secTitle">Prompturile AI</h2>
        <p className="hint">Textele trimise la AI pentru fiecare tip de generare. Modificările se aplică imediat; „Revino la textul implicit” readuce varianta din aplicație. La fiecare text se adaugă automat datele analizei și completările evaluatorului; la „Personalizat”, și promptul utilizatorului.</p>
        <PromptEditor items={items} />
        <AiLimits limits={limits} used={totals} />
        <UserLimits rows={excRows} general={{ ai_text: limits.ai_text, ai_plan: limits.ai_plan }} />
        <h2 className="secTitle">Statistici</h2>
        <div className="kpis">
          <div className="kpi"><small>Texte generate · 30 zile</small><b>{ai.texts}</b></div>
          <div className="kpi"><small>Planuri citite · 30 zile</small><b>{ai.plans}</b></div>
          <div className="kpi"><small>Tokeni AI (intrare / ieșire)</small><b style={{ fontSize: 16 }}>{ai.tin.toLocaleString("ro-RO")} / {ai.tout.toLocaleString("ro-RO")}</b></div>
        </div>
        <ToolAnalytics u={u} events={events} targetLabel="Imobile analizate" />
        <CountTable title="Texte generate, pe variante (30 de zile)" rows={ai.byStyle.map(([s, n]) => [s, n])} head={["Variantă", "Texte"]} empty="Niciun text generat încă." />
      </AdminShell>
    );
  }

  if (key === "colaborari") {
    const cs = await collabSettings(db);
    const [users, counts, all, firms] = await Promise.all([testUsers(db, cs.users), collabCounts(db),
      db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, u.anevar_no AS anevar, u.is_superadmin AS sup,
          (SELECT o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active' ORDER BY o.name LIMIT 1) AS org
        FROM users u WHERE u.status = 'active' ORDER BY name COLLATE NOCASE LIMIT 3000`)
        .all<{ id: string; name: string; email: string; anevar: string | null; sup: number; org: string | null }>(),
      // "Anunță-mă, vreau să postez" from the "De la firme" tab
      db.prepare(`SELECT COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, o.name AS org, MIN(e.at) AS at FROM events e JOIN users u ON u.id = e.user_id LEFT JOIN orgs o ON o.id = e.org_id
        WHERE e.module = 'home' AND e.action = 'notify' AND e.target = 'angajare' GROUP BY e.user_id ORDER BY at DESC LIMIT 500`)
        .all<{ name: string; email: string; org: string | null; at: string }>()]);
    return (
      <AdminShell c={c} active="instrumente" pending={pending} title={tool.name} subtitle="Mod de lucru, grupul de test și statistici" actions={<a className="btn btnGhost btnSm" href="/admin/instrumente">← Instrumente</a>}>
        <CollabAdmin mode={cs.mode} users={users} counts={counts} accounts={all.results} />
        <section className="card">
          <div className="cardHead"><h2>Vor să posteze anunțuri de angajare</h2><span className="pill"><i />{firms.results.length}</span></div>
          <p className="hint">Cine a apăsat „Anunță-mă, vreau să postez” în tab-ul „De la firme”. Îi anunțăm la lansarea anunțurilor de angajare.</p>
          {firms.results.length ? (
            <div className="tableWrap">
              <table className="table" style={{ minWidth: 0 }}>
                <thead><tr><th>Persoană</th><th>Firmă</th><th>Când</th></tr></thead>
                <tbody>{firms.results.map((f) => <tr key={f.email}><td><b>{f.name}</b><div className="muted" style={{ fontSize: 12 }}>{f.email}</div></td><td>{f.org ?? "—"}</td><td>{fmtDate(f.at, true)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="hint">Nimeni încă.</p>}
        </section>
        <h2 className="secTitle">Statistici</h2>
        <ToolAnalytics u={u} events={events} />
      </AdminShell>
    );
  }

  const features = FEATURES.filter((f) => f.tool === key).map((f) => ({ key: f.key, name: f.name, desc: f.desc, on: !off.includes(f.key) }));
  return (
    <AdminShell c={c} active="instrumente" pending={pending} title={tool.name} subtitle="Statistici și stare" actions={<a className="btn btnGhost btnSm" href="/admin/instrumente">← Instrumente</a>}>
      {switchCard}
      {features.length > 0 && <FeatureSwitches items={features} />}
      <h2 className="secTitle">Statistici</h2>
      <ToolAnalytics u={u} events={events} />
    </AdminShell>
  );
}
