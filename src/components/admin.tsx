"use client";

import { useState } from "react";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
  return r?.ok ? null : d?.error || "Nu am putut salva. Încearcă din nou.";
}

/** Approve (plan, access until, individual account or an existing firm) or reject a request. */
export function RequestActions({ id, name, plans, firms, until }: { id: string; name: string; plans: { id: string; name: string }[]; firms: { id: string; name: string; seats: number; used: number }[]; until: string }) {
  const [mode, setMode] = useState<"" | "approve" | "reject">("");
  const [f, setF] = useState({ plan_id: plans[0]?.id ?? "trial", valid_until: until, org: "", note: "", notify: true });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (action: "approve" | "reject") => {
    setBusy(true); setMsg("");
    const e = await post(`/api/admin/requests/${id}`, { action, ...f });
    setBusy(false);
    if (e) return setMsg(e);
    location.reload();
  };
  if (!mode) return (
    <div className="actions" style={{ justifyContent: "flex-end" }}>
      <button type="button" className="btn btnNavy btnSm" onClick={() => setMode("approve")}>Aprobă</button>
      <button type="button" className="btn btnGhost btnSm" onClick={() => setMode("reject")}>Respinge</button>
    </div>
  );
  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }} onSubmit={(e) => { e.preventDefault(); go(mode); }}>
      {mode === "approve" ? (
        <>
          <label className="field">Cont
            <select className="select" value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })}>
              <option value="">Cont individual (nou)</option>
              {firms.map((o) => <option key={o.id} value={o.id} disabled={o.used >= o.seats}>{o.name} · {o.used}/{o.seats} locuri</option>)}
            </select>
          </label>
          {!f.org && (
            <>
              <label className="field">Plan<select className="select" value={f.plan_id} onChange={(e) => setF({ ...f, plan_id: e.target.value })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="field"><span>Acces până la <small>(gol = fără termen)</small></span><input className="input" type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></label>
            </>
          )}
          <p className="hint">{name} primește pe email linkul de activare.</p>
        </>
      ) : (
        <>
          <label className="field">Motiv <small>(opțional)</small><textarea className="textarea" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} />Anunță-l pe email</label>
        </>
      )}
      {msg && <div role="alert" className="error">{msg}</div>}
      <div className="actions">
        <button type="submit" className={`btn btnSm ${mode === "approve" ? "btnNavy" : "btnGhost"}`} disabled={busy}>{busy ? "Se salvează…" : mode === "approve" ? "Aprobă și trimite invitația" : "Respinge"}</button>
        <button type="button" className="linkBtn" onClick={() => setMode("")}>Renunță</button>
      </div>
    </form>
  );
}

/** Admin → Panou: maintenance mode (people see the maintenance page; UVALO administrators keep access). */
export function MaintenanceCard({ on: on0, message: m0, placeholder }: { on: boolean; message: string; placeholder: string }) {
  const [on, setOn] = useState(on0);
  const [message, setMessage] = useState(m0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async (next: boolean) => {
    if (next && !on && !confirm("Pornești mentenanța? Utilizatorii vor vedea doar pagina „Revenim în curând” până o oprești.")) return;
    setBusy(true); setMsg("");
    const e = await post("/api/admin/maintenance", { on: next, message });
    setBusy(false);
    if (e) return setMsg(e);
    setOn(next);
    setMsg(next ? "Mentenanța e pornită." : "Mentenanța e oprită: platforma e din nou deschisă tuturor.");
  };
  return (
    <section className="card" style={{ borderColor: on ? "#e8b25c" : undefined, background: on ? "#fdf6ea" : undefined }}>
      <div className="cardHead">
        <h2>Mod mentenanță</h2>
        <span className={`pill ${on ? "pillWarn" : "pillOk"}`}><i />{on ? "Pornit · utilizatorii văd pagina de mentenanță" : "Oprit · platforma e deschisă"}</span>
      </div>
      <p className="hint">Cât e pornit, utilizatorii văd doar pagina „Revenim în curând” (și nu se pot face cereri de cont sau accepta invitații). Administratorii UVALO folosesc platforma normal. API-ul folosit de CRM rămâne activ.</p>
      <label className="field">Mesajul de pe pagina de mentenanță
        <textarea className="textarea" rows={2} maxLength={300} value={message} placeholder={placeholder} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {msg && <div role="status" className={msg.startsWith("Mentenanța") ? "okMsg" : "error"}>{msg}</div>}
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        {on
          ? <><button type="button" className="btn btnNavy btnSm" disabled={busy} onClick={() => save(false)}>{busy ? "…" : "Oprește mentenanța"}</button>
            <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => save(true)}>Salvează mesajul</button>
            <a className="link" href="/mentenanta?preview=1" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Vezi pagina</a></>
          : <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => save(true)}>{busy ? "…" : "Pornește mentenanța"}</button>}
      </div>
    </section>
  );
}

/** Turns a tool on or off for everyone (UVALO administrators keep using it). */
export function ToolSwitch({ k, name, on: on0 }: { k: string; name: string; on: boolean }) {
  const [on, setOn] = useState(on0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async () => {
    if (on && !confirm(`Dezactivezi „${name}”? Utilizatorii nu îl vor mai vedea până îl activezi din nou.`)) return;
    setBusy(true); setMsg("");
    const e = await post("/api/admin/tools", { key: k, on: !on });
    setBusy(false);
    if (e) return setMsg(e);
    setOn(!on);
  };
  return (
    <section className="card" style={{ borderColor: on ? undefined : "#e8b25c", background: on ? undefined : "#fdf6ea" }}>
      <div className="cardHead">
        <h2>Stare</h2>
        <span className={`pill ${on ? "pillOk" : "pillWarn"}`}><i />{on ? "Activ · disponibil utilizatorilor" : "Dezactivat · ascuns utilizatorilor"}</span>
      </div>
      <p className="hint">Dezactivat, instrumentul dispare din meniu și de pe pagina de start, iar pagina lui afișează „dezactivat temporar”. Administratorii UVALO îl folosesc în continuare, ca să-l poată verifica.</p>
      {msg && <div role="alert" className="error">{msg}</div>}
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className={`btn btnSm ${on ? "btnGhost" : "btnNavy"}`} disabled={busy} onClick={go}>{busy ? "…" : on ? "Dezactivează" : "Activează"}</button>
      </div>
    </section>
  );
}

/** On/off for the parts of a tool (e.g. Anexă foto and Anexă documente in UVALO pentru Word). */
export function FeatureSwitches({ items }: { items: { key: string; name: string; desc: string; on: boolean }[] }) {
  const [state, setState] = useState(() => Object.fromEntries(items.map((i) => [i.key, i.on])));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const go = async (i: { key: string; name: string }) => {
    const on = state[i.key];
    if (on && !confirm(`Dezactivezi „${i.name}”? Utilizatorii văd „dezactivat temporar” până îl activezi din nou.`)) return;
    setBusy(i.key); setMsg("");
    const e = await post("/api/admin/tools", { key: i.key, on: !on });
    setBusy("");
    if (e) return setMsg(e);
    setState((s) => ({ ...s, [i.key]: !on }));
  };
  return (
    <section className="card">
      <div className="cardHead"><h2>Funcții</h2></div>
      <p className="hint">Fiecare funcție se poate opri separat. Administratorii UVALO le folosesc în continuare, ca să le poată verifica.</p>
      {msg && <div role="alert" className="error">{msg}</div>}
      <div className="tableWrap">
        <table className="table">
          <tbody>
            {items.map((i) => (
              <tr key={i.key}>
                <td><b>{i.name}</b><div className="muted" style={{ fontSize: 12 }}>{i.desc}</div></td>
                <td><span className={`pill ${state[i.key] ? "pillOk" : "pillWarn"}`}><i />{state[i.key] ? "Activă" : "Dezactivată"}</span></td>
                <td className="r"><button type="button" className={`btn btnSm ${state[i.key] ? "btnGhost" : "btnNavy"}`} disabled={!!busy} onClick={() => go(i)}>{busy === i.key ? "…" : state[i.key] ? "Dezactivează" : "Activează"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type LimitVals = { ai_text: number; ai_plan: number; total_text_day: number; total_plan_day: number; total_text_month: number; total_plan_month: number };

/** AI limits: per person per 24 hours, and platform caps per day and month (0 = no cap), with today's and this month's use. */
export function AiLimits({ limits, used }: { limits: LimitVals; used: { text_day: number; plan_day: number; text_month: number; plan_month: number } }) {
  const [f, setF] = useState(limits);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setBusy(true); setMsg("");
    const e = await post("/api/admin/tools", { limits: f });
    setBusy(false);
    setMsg(e ?? "Limitele au fost salvate.");
  };
  const num = (k: keyof LimitVals, label: string, note?: string) => (
    <label className="field">{label}{note && <small className="muted"> {note}</small>}
      <input className="input" type="number" min={k.startsWith("total") ? 0 : 1} max={100000} value={f[k]} onChange={(e) => setF({ ...f, [k]: +e.target.value })} />
    </label>
  );
  return (
    <section className="card">
      <h2>Limite AI</h2>
      <p className="hint">Pe utilizator: câte cereri poate face o persoană în 24 de ore (cine are o excepție, mai jos, o folosește pe aceea). Pe platformă: câte cereri se pot face în total, de toți, într-o zi și într-o lună calendaristică; 0 = fără plafon. Administratorii UVALO nu au limită.</p>
      <h3 style={{ margin: "6px 0 0", fontSize: 13 }}>Pe utilizator, în 24 de ore</h3>
      <div className="cols">{num("ai_text", "Texte generate")}{num("ai_plan", "Planuri de amplasament citite")}</div>
      <h3 style={{ margin: "6px 0 0", fontSize: 13 }}>Total pe platformă</h3>
      <div className="cols">
        {num("total_text_day", "Texte pe zi", `· azi: ${used.text_day}`)}
        {num("total_plan_day", "Planuri pe zi", `· azi: ${used.plan_day}`)}
        {num("total_text_month", "Texte pe lună", `· luna aceasta: ${used.text_month}`)}
        {num("total_plan_month", "Planuri pe lună", `· luna aceasta: ${used.plan_month}`)}
      </div>
      {msg && <div role="status" className={msg.startsWith("Limitele") ? "okMsg" : "error"}>{msg}</div>}
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="btn btnNavy btnSm" disabled={busy} onClick={save}>{busy ? "…" : "Salvează limitele"}</button>
      </div>
    </section>
  );
}

/** Exceptions per person to the daily limits: list, change, remove, add by email. */
export function UserLimits({ rows, general }: { rows: { id: string; name: string; email: string; ai_text?: number; ai_plan?: number }[]; general: { ai_text: number; ai_plan: number } }) {
  const [f, setF] = useState({ email: "", ai_text: "", ai_plan: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const send = async (body: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    const e = await post("/api/admin/limits", body);
    setBusy(false);
    if (e) return setMsg(e);
    location.reload();
  };
  return (
    <section className="card">
      <h2>Excepții pe utilizator</h2>
      <p className="hint">Limită proprie, în 24 de ore, pentru o persoană anume. Câmp gol = limita generală ({general.ai_text} texte, {general.ai_plan} planuri).</p>
      {rows.length > 0 && (
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>Utilizator</th><th className="r">Texte</th><th className="r">Planuri</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.email}</div></td>
                  <td className="r mono">{r.ai_text ?? <span className="muted">{general.ai_text}</span>}</td>
                  <td className="r mono">{r.ai_plan ?? <span className="muted">{general.ai_plan}</span>}</td>
                  <td className="r">
                    <button type="button" className="linkBtn" onClick={() => setF({ email: r.email, ai_text: r.ai_text?.toString() ?? "", ai_plan: r.ai_plan?.toString() ?? "" })}>Modifică</button>{" · "}
                    <button type="button" className="linkBtn" disabled={busy} onClick={() => { if (confirm(`Scoți excepția pentru ${r.name}?`)) send({ userId: r.id }); }}>Scoate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); send({ email: f.email, ai_text: f.ai_text, ai_plan: f.ai_plan }); }}>
        <label className="field" style={{ flex: "2 1 240px" }}>Emailul utilizatorului<input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nume@firma.ro" /></label>
        <label className="field" style={{ flex: "1 1 120px" }}>Texte / 24 h<input className="input" type="number" min={0} value={f.ai_text} onChange={(e) => setF({ ...f, ai_text: e.target.value })} placeholder={String(general.ai_text)} /></label>
        <label className="field" style={{ flex: "1 1 120px" }}>Planuri / 24 h<input className="input" type="number" min={0} value={f.ai_plan} onChange={(e) => setF({ ...f, ai_plan: e.target.value })} placeholder={String(general.ai_plan)} /></label>
        <button type="submit" className="btn btnNavy btnSm" disabled={busy}>{busy ? "…" : "Salvează excepția"}</button>
      </form>
      {msg && <div role="alert" className="error">{msg}</div>}
    </section>
  );
}

/** The AI prompts in use, editable; "Revino la textul implicit" restores the one written in the code. */
export function PromptEditor({ items }: { items: { key: string; name: string; desc: string; value: string; def: string }[] }) {
  const [vals, setVals] = useState(Object.fromEntries(items.map((i) => [i.key, i.value])) as Record<string, string>);
  const [saved, setSaved] = useState(Object.fromEntries(items.map((i) => [i.key, i.value])) as Record<string, string>);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<Record<string, string>>({});
  const save = async (k: string, v: string, def: string) => {
    setBusy(k); setMsg({ ...msg, [k]: "" });
    const e = await post("/api/admin/prompts", { [k]: v });
    setBusy("");
    if (e) return setMsg({ ...msg, [k]: e });
    const now = v.trim() ? v.trim() : def;
    setSaved({ ...saved, [k]: now }); setVals({ ...vals, [k]: now });
    setMsg({ ...msg, [k]: "Salvat. Se folosește de la următoarea generare." });
  };
  return (
    <>
      {items.map((i) => {
        const v = vals[i.key], dirty = v !== saved[i.key], custom = saved[i.key] !== i.def;
        return (
          <section key={i.key} className="card">
            <div className="cardHead">
              <h2>{i.name}</h2>
              <span className={`pill ${custom ? "pillWarn" : "pillOk"}`}><i />{custom ? "Modificat" : "Implicit"}</span>
            </div>
            <p className="hint">{i.desc}</p>
            <label className="field"><span className="sr-only">{i.name}</span>
              <textarea className="textarea" rows={Math.min(18, Math.max(4, v.split("\n").length + 1))} value={v} onChange={(e) => setVals({ ...vals, [i.key]: e.target.value })} style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.55 }} />
            </label>
            {msg[i.key] && <div role="status" className={msg[i.key].startsWith("Salvat") ? "okMsg" : "error"}>{msg[i.key]}</div>}
            <div className="actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="btn btnNavy btnSm" disabled={!dirty || busy === i.key} onClick={() => save(i.key, v, i.def)}>{busy === i.key ? "…" : "Salvează"}</button>
              {dirty && <button type="button" className="btn btnGhost btnSm" onClick={() => setVals({ ...vals, [i.key]: saved[i.key] })}>Renunță la modificări</button>}
              {custom && <button type="button" className="btn btnGhost btnSm" disabled={busy === i.key} onClick={() => { if (confirm("Revii la textul implicit?")) save(i.key, "", i.def); }}>Revino la textul implicit</button>}
            </div>
          </section>
        );
      })}
    </>
  );
}

type CollabMode = "off" | "test" | "on";
type Counts = Record<string, { all: number; test: number }>;
const COUNT_LABEL: Record<string, string> = { profiles: "Profiluri", posts: "Anunțuri", requests: "Cereri de detalii", convs: "Conversații", messages: "Mesaje", notifs: "Notificări" };

/** Colaborări: mode (Dezactivat / Test / Activ), the people in the test group, deleting the test data. */
type Account = { id: string; name: string; email: string; anevar: string | null; sup: number; org: string | null };
export function CollabAdmin({ mode: m0, users: u0, counts: c0, accounts }: { mode: CollabMode; users: { id: string; name: string; email: string; anevar: string | null }[]; counts: Counts; accounts: Account[] }) {
  const [mode, setMode] = useState(m0);
  const [users, setUsers] = useState(u0);
  const [counts, setCounts] = useState(c0);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const send = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/admin/colaborari", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, unknown> & { error?: string };
    return r?.ok ? d : { error: d.error || "Nu am putut salva. Încearcă din nou." };
  };
  const run = async (key: string, body: Record<string, unknown>, done: (d: Record<string, unknown>) => void) => {
    setBusy(key); setMsg(""); setOk("");
    const d = await send(body);
    setBusy("");
    if (d.error) return setMsg(String(d.error));
    done(d);
  };
  const MODES: [CollabMode, string, string][] = [
    ["off", "Dezactivat", "Doar administratorii UVALO văd modulul (în meniu, ca să-l poată verifica)."],
    ["test", "Test", "Administratorii UVALO și persoanele din grupul de test de mai jos."],
    ["on", "Activ", "Toți utilizatorii cu acces la platformă. Datele noi nu mai sunt marcate ca test."],
  ];
  const testTotal = Object.values(counts).reduce((s, x) => s + x.test, 0);
  return (
    <>
      <section className="card" style={{ borderColor: mode === "on" ? undefined : "#e8b25c", background: mode === "on" ? undefined : "#fdf6ea" }}>
        <div className="cardHead">
          <h2>Mod de lucru</h2>
          <span className={`pill ${mode === "on" ? "pillOk" : "pillWarn"}`}><i />{MODES.find((x) => x[0] === mode)![1]}</span>
        </div>
        <p className="hint">Cât timp modulul nu e „Activ”, tot ce se introduce (profiluri, anunțuri, cereri, mesaje, notificări) e marcat ca <b>date de test</b> și se poate șterge cu butonul de mai jos.</p>
        <div className="tableWrap">
          <table className="table" style={{ minWidth: 0 }}>
            <tbody>
              {MODES.map(([k, l, d]) => (
                <tr key={k}>
                  <td><b>{l}</b><div className="muted" style={{ fontSize: 12 }}>{d}</div></td>
                  <td className="r">
                    {mode === k ? <span className="pill pillOk"><i />Modul curent</span> : (
                      <button type="button" className={`btn btnSm ${k === "on" ? "btnNavy" : "btnGhost"}`} disabled={!!busy}
                        onClick={() => (k !== "on" || confirm(testTotal ? `Activezi Colaborările pentru toți utilizatorii? Există ${testTotal} înregistrări de test care vor rămâne vizibile până le ștergi.` : "Activezi Colaborările pentru toți utilizatorii?"))
                          && run(`m-${k}`, { action: "mode", mode: k }, () => { setMode(k); setOk(`Modul este acum „${l}”.`); })}>
                        {busy === `m-${k}` ? "…" : `Treci pe ${l}`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && <div role="alert" className="error">{msg}</div>}
        {ok && <div role="status" className="hint" style={{ color: "var(--ok-text)", fontWeight: 700 }}>{ok}</div>}
      </section>

      <div className="cols">
        <section className="card">
          <div className="cardHead"><h2>Grupul de test</h2><span className="pill"><i />{users.length === 1 ? "1 persoană" : `${users.length} persoane`}</span></div>
          <p className="hint">În modul Test, Colaborările le apar doar acestor persoane (plus administratorilor UVALO), indiferent de abonament. Bifează conturile din listă și apasă „Adaugă în test”.</p>
          {(() => {
            const inTest = new Set(users.map((u) => u.id));
            const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const nq = norm(q.trim());
            const list = accounts.filter((a) => !inTest.has(a.id) && !a.sup && (!nq || norm(`${a.name} ${a.email} ${a.anevar ?? ""} ${a.org ?? ""}`).includes(nq)));
            const shown = list.slice(0, 60);
            return (
              <div className="pickBox">
                <input className="input" type="search" aria-label="Caută un cont" placeholder="Caută după nume, email, legitimație sau firmă" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="pickList" role="group" aria-label="Conturi">
                  {shown.length === 0 && <p className="hint" style={{ padding: "10px 12px" }}>{q ? "Niciun cont găsit." : "Toate conturile sunt deja în grupul de test."}</p>}
                  {shown.map((a) => (
                    <label key={a.id} className="pickRow">
                      <input type="checkbox" checked={sel.includes(a.id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, a.id] : x.filter((y) => y !== a.id)))} />
                      <span><b>{a.name}</b><small>{[a.email, a.anevar ? `ANEVAR ${a.anevar}` : null, a.org].filter(Boolean).join(" · ")}</small></span>
                    </label>
                  ))}
                  {list.length > shown.length && <p className="hint" style={{ padding: "8px 12px" }}>Încă {list.length - shown.length} conturi: restrânge căutarea.</p>}
                </div>
                <div className="actions" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span className="hint">{sel.length ? `${sel.length} ${sel.length === 1 ? "cont selectat" : "conturi selectate"}` : "Niciun cont selectat"}{sel.length > 0 && <> · <button type="button" className="linkBtn" onClick={() => setSel([])}>Deselectează</button></>}</span>
                  <button type="button" className="btn btnNavy btnSm" disabled={!!busy || !sel.length}
                    onClick={() => run("add", { action: "add_many", user_ids: sel }, (d) => { const added = (d.users as (typeof users)) ?? []; setUsers((x) => [...x, ...added.filter((u) => !x.some((y) => y.id === u.id))]); setSel([]); setOk(added.length === 1 ? `${added[0].name} a fost adăugat în grupul de test.` : `${added.length} persoane au fost adăugate în grupul de test.`); })}>
                    {busy === "add" ? "…" : sel.length > 1 ? `Adaugă ${sel.length} în test` : "Adaugă în test"}
                  </button>
                </div>
              </div>
            );
          })()}
          {users.length > 0 ? (
            <div className="tableWrap">
              <table className="table" style={{ minWidth: 0 }}>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><b>{u.name}</b><div className="muted" style={{ fontSize: 12 }}>{u.email}{u.anevar ? ` · ANEVAR ${u.anevar}` : ""}</div></td>
                      <td className="r"><button type="button" className="linkBtn danger" disabled={!!busy} onClick={() => run(`r-${u.id}`, { action: "remove", user_id: u.id }, () => setUsers((x) => x.filter((y) => y.id !== u.id)))}>Scoate</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="hint">Nicio persoană în grupul de test.</p>}
        </section>

        <section className="card">
          <div className="cardHead"><h2>Date de test</h2><span className={`pill ${testTotal ? "pillWarn" : ""}`}><i />{testTotal} înregistrări</span></div>
          <div className="tableWrap">
            <table className="table" style={{ minWidth: 0 }}>
              <thead><tr><th>Ce</th><th>Test</th><th>Total</th></tr></thead>
              <tbody>
                {Object.entries(counts).map(([k, v]) => <tr key={k}><td>{COUNT_LABEL[k] ?? k}</td><td><b>{v.test}</b></td><td>{v.all}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="hint">Șterge tot ce s-a introdus cât timp modulul nu era „Activ”: profilurile, anunțurile, cererile, conversațiile, mesajele și notificările de test. Persoanele din test vor trece din nou prin activare. Statisticile de folosire rămân.</p>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="btn btnDanger btnSm" disabled={!!busy || !testTotal}
              onClick={() => confirm(`Ștergi definitiv cele ${testTotal} înregistrări de test din Colaborări? Nu se poate anula.`) && run("purge", { action: "purge" }, (d) => { setCounts(d.counts as Counts); setOk(`Am șters ${d.deleted} înregistrări de test.`); })}>
              {busy === "purge" ? "Se șterge…" : "Șterge datele de test"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

const FB_STATUS: Record<string, string> = { nou: "Nou", citit: "Citit", rezolvat: "Rezolvat" };

/** Admin → Feedback: status of a message, an internal note and a reply by email. */
export function FeedbackActions({ id, status: s0, email, note: n0 }: { id: number; status: string; email: string | null; note: string | null }) {
  const [status, setStatus] = useState(s0);
  const [note, setNote] = useState(n0 ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await fetch(`/api/admin/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    return !!r?.ok;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", minWidth: 170 }}>
      <span className={`pill ${status === "rezolvat" ? "pillOk" : status === "nou" ? "pillWarn" : ""}`}><i />{FB_STATUS[status] ?? status}</span>
      <div className="actions" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
        {status === "nou" && <button type="button" className="linkBtn" disabled={busy} onClick={async () => (await save({ status: "citit" })) && setStatus("citit")}>Citit</button>}
        {status !== "rezolvat"
          ? <button type="button" className="linkBtn" disabled={busy} onClick={async () => (await save({ status: "rezolvat" })) && setStatus("rezolvat")}>Rezolvat</button>
          : <button type="button" className="linkBtn" disabled={busy} onClick={async () => (await save({ status: "citit" })) && setStatus("citit")}>Redeschide</button>}
        {email && <a className="linkBtn" href={`mailto:${email}?subject=${encodeURIComponent("Răspuns la feedback-ul tău UVALO")}`}>Răspunde</a>}
        <button type="button" className="linkBtn" onClick={() => setEditing(!editing)}>{note ? "Notă" : "+ Notă"}</button>
      </div>
      {editing && (
        <form style={{ display: "flex", flexDirection: "column", gap: 6, width: 220 }} onSubmit={async (e) => { e.preventDefault(); if (await save({ note })) setEditing(false); }}>
          <textarea className="textarea" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} aria-label="Notă internă" />
          <button type="submit" className="btn btnSm btnNavy" disabled={busy}>Salvează nota</button>
        </form>
      )}
      {!editing && note && <span className="muted" style={{ fontSize: 12, maxWidth: 220, textAlign: "right" }}>{note}</span>}
    </div>
  );
}
