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
