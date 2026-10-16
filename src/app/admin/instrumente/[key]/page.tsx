import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmtDate, superPage } from "@/lib/guard";
import { countyOfUats, githubReady, listUploads, refresh, uats } from "@/lib/plans";
import { recentEvents } from "@/lib/orgs";
import { aiTotals, aiUsage, FEATURES, userLimits, PROMPT_DEFAULTS, PROMPT_LABELS, type PromptKey, prompts, toolByKey, toolSettings, toolUsage } from "@/lib/tools";
import { roDate } from "@/lib/plan-format";
import { AdminShell } from "@/components/AdminShell";
import { AiLimits, CollabAdmin, LaunchMail, FeatureSwitches, PromptEditor, ToolSwitch, UserLimits } from "@/components/admin";
import { collabCounts, collabSettings, launchSubscribers, testUsers } from "@/lib/collab";
import { modeSettings } from "@/lib/modmode";
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

  if (key === "acasa") {
    const ms = await modeSettings(db, "acasa");
    const [users, all] = await Promise.all([testUsers(db, ms.users),
      db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, u.anevar_no AS anevar, u.is_superadmin AS sup,
          (SELECT o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active' ORDER BY o.name LIMIT 1) AS org
        FROM users u WHERE u.status = 'active' ORDER BY name COLLATE NOCASE LIMIT 3000`)
        .all<{ id: string; name: string; email: string; anevar: string | null; sup: number; org: string | null }>()]);
    return (
      <AdminShell c={c} active="instrumente" pending={pending} title={tool.name} subtitle="Pagina de start nouă: mod de lucru și grupul de test" actions={<a className="btn btnGhost btnSm" href="/admin/instrumente">← Instrumente</a>}>
        <CollabAdmin mode={ms.mode} users={users} counts={null} accounts={all.results} endpoint="/api/admin/acasa" name="Pagina Acasă nouă"
          testNote={<>„Dezactivat”: toți (și super-adminii) văd pagina Acasă de acum. „Test”: super-adminii și grupul de test văd pagina nouă. „Activ”: toți o văd.</>} />
        <ToolAnalytics u={u} events={events} />
      </AdminShell>
    );
  }

  if (key === "inspectii") {
    const ms = await modeSettings(db, "inspectii");
    const [users, all, n] = await Promise.all([testUsers(db, ms.users),
      db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, u.anevar_no AS anevar, u.is_superadmin AS sup,
          (SELECT o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active' ORDER BY o.name LIMIT 1) AS org
        FROM users u WHERE u.status = 'active' ORDER BY name COLLATE NOCASE LIMIT 3000`)
        .all<{ id: string; name: string; email: string; anevar: string | null; sup: number; org: string | null }>(),
      db.prepare(`SELECT COUNT(*) AS total, SUM(status IN ('gata', 'pred')) AS done, COUNT(DISTINCT created_by) AS people,
          (SELECT COUNT(*) FROM insp_devices) AS phones, (SELECT COUNT(*) FROM insp_files WHERE kind = 'photo') AS photos
        FROM inspections WHERE deleted_at IS NULL`).first<{ total: number; done: number | null; people: number; phones: number; photos: number }>()]);
    return (
      <AdminShell c={c} active="instrumente" pending={pending} title={tool.name} subtitle="Mod de lucru, grupul de test și statistici" actions={<a className="btn btnGhost btnSm" href="/admin/instrumente">← Instrumente</a>}>
        <CollabAdmin mode={ms.mode} users={users} counts={null} accounts={all.results} endpoint="/api/admin/inspectii" name="Inspecțiile"
          testNote={<>Cât timp modulul nu e „Activ”, în meniu apare cu eticheta TEST. Persoanele din grupul de test îl folosesc pe web și în aplicația de telefon (inspectii.uvalo.ro), indiferent de abonament.</>} />
        <h2 className="secTitle">Statistici</h2>
        <div className="kpis">
          <div className="kpi"><small>Inspecții</small><b>{n?.total ?? 0}</b></div>
          <div className="kpi"><small>Finalizate</small><b>{n?.done ?? 0}</b></div>
          <div className="kpi"><small>Persoane care au creat</small><b>{n?.people ?? 0}</b></div>
          <div className="kpi"><small>Telefoane conectate</small><b>{n?.phones ?? 0}</b></div>
          <div className="kpi"><small>Fotografii</small><b>{n?.photos ?? 0}</b></div>
        </div>
        <ToolAnalytics u={u} events={events} />
      </AdminShell>
    );
  }

  if (key === "colaborari") {
    const cs = await collabSettings(db);
    const [users, counts, all, firms, actv, subs] = await Promise.all([testUsers(db, cs.users), collabCounts(db),
      db.prepare(`SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, u.anevar_no AS anevar, u.is_superadmin AS sup,
          (SELECT o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = u.id AND m.status = 'active' ORDER BY o.name LIMIT 1) AS org
        FROM users u WHERE u.status = 'active' ORDER BY name COLLATE NOCASE LIMIT 3000`)
        .all<{ id: string; name: string; email: string; anevar: string | null; sup: number; org: string | null }>(),
      // "Anunță-mă, vreau să postez" from the "De la firme" tab
      db.prepare(`SELECT COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, o.name AS org, MIN(e.at) AS at FROM events e JOIN users u ON u.id = e.user_id LEFT JOIN orgs o ON o.id = e.org_id
        WHERE e.module = 'home' AND e.action = 'notify' AND e.target = 'angajare' GROUP BY e.user_id ORDER BY at DESC LIMIT 500`)
        .all<{ name: string; email: string; org: string | null; at: string }>(),
      // who activated Colaborări (has a profile)
      db.prepare(`SELECT COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, u.anevar_no AS anevar, p.county, p.city, p.available, p.zone_mode, p.radius, p.extra, p.test, p.created_at AS at
        FROM collab_profiles p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 2000`)
        .all<{ name: string; email: string; anevar: string | null; county: string | null; city: string | null; available: number; zone_mode: string; radius: number; extra: string; test: number; at: string }>(),
      launchSubscribers(db)]);
    const subsWaiting = subs.filter((r) => !r.active && !r.mailed);
    return (
      <AdminShell c={c} active="instrumente" pending={pending} title={tool.name} subtitle="Mod de lucru, grupul de test și statistici" actions={<a className="btn btnGhost btnSm" href="/admin/instrumente">← Instrumente</a>}>
        <CollabAdmin mode={cs.mode} users={users} counts={counts} accounts={all.results} />
        <section className="card">
          <div className="cardHead"><h2>Cine a activat Colaborările</h2><span className="pill pillOk"><i />{actv.results.length}</span></div>
          <p className="hint">Conturile care și-au completat activarea (profil și zonă). Pe Acasă și în pagina de activare apare „{Math.max(20, actv.results.length)} colegi l-au activat deja” (minimum 20).</p>
          {actv.results.length ? (
            <div className="tableWrap">
              <table className="table" style={{ minWidth: 0 }}>
                <thead><tr><th>Persoană</th><th>Zonă</th><th>Disponibil</th><th>Activat</th></tr></thead>
                <tbody>{actv.results.map((r) => {
                  let extra: string[] = []; try { extra = JSON.parse(r.extra); } catch {}
                  return (
                    <tr key={r.email}>
                      <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.email}{r.anevar ? ` · leg. ${r.anevar}` : ""}</div></td>
                      <td>{r.county ? `${r.city ? `${r.city}, ` : ""}${r.county} · ${r.zone_mode === "judet" ? "tot județul" : `rază ${r.radius} km`}` : "—"}{extra.length ? <div className="muted" style={{ fontSize: 12 }}>+ {extra.join(", ")}</div> : null}</td>
                      <td>{r.available ? <span className="pill pillOk"><i />Da</span> : <span className="pill"><i />Doar se uită</span>}</td>
                      <td>{fmtDate(r.at, true)}{r.test ? <div className="muted" style={{ fontSize: 12 }}>în test</div> : null}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : <p className="hint">Nimeni încă.</p>}
        </section>
        <section className="card">
          <div className="cardHead"><h2>Anunțul de lansare</h2><span className="pill"><i />{subs.length} abonați</span></div>
          <p className="hint">Cine a apăsat „Anunță-mă la lansare” pentru Colaborări. Emailul „Colaborările sunt aici” (cu imagine și buton care îi autentifică direct, valabil 7 zile) pleacă o singură dată fiecăruia, doar celor care au acces acum ({cs.mode === "on" ? "toți, modul e Activ" : cs.mode === "test" ? "în Test: doar grupul de test" : "modul e Dezactivat: nimeni"}) și nu au activat deja.</p>
          <LaunchMail ready={subsWaiting.filter((r) => r.allowed).length} waiting={subsWaiting.length} sent={subs.filter((r) => r.mailed).length} activated={subs.filter((r) => r.active).length} />
          {subs.length > 0 && (
            <div className="tableWrap">
              <table className="table" style={{ minWidth: 0 }}>
                <thead><tr><th>Persoană</th><th>S-a abonat</th><th>Stare</th></tr></thead>
                <tbody>{subs.map((r) => (
                  <tr key={r.id}><td><b>{r.name || r.email}</b><div className="muted" style={{ fontSize: 12 }}>{r.email}</div></td><td>{fmtDate(r.at, true)}</td>
                    <td>{r.active ? <span className="pill pillOk"><i />A activat</span> : r.mailed ? <span className="pill pillInfo"><i />Email trimis {fmtDate(r.mailed)}</span> : r.allowed ? <span className="pill pillWarn"><i />De anunțat</span> : <span className="pill"><i />Fără acces încă</span>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
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
