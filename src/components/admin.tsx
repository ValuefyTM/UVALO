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
