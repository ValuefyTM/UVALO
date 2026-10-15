"use client";

import { useState } from "react";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(j.error || "Nu a mers.");
  return j;
}

/** The inspection document's buttons: PDF (print), link, mark as delivered, and in test mode "simulate the phone". */
export function InspDocActions({ id, done, delivered, canSimulate, canReopen = false, assignee = null, children }: {
  id: string; done: boolean; delivered: boolean; canSimulate: boolean; canReopen?: boolean; assignee?: string | null; children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [redo, setRedo] = useState(false);
  const [note, setNote] = useState("");
  const run = async (b: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    try { await post({ id, ...b }); location.reload(); } catch (e) { setMsg((e as Error).message); setBusy(false); }
  };
  return (
    <div className="inDocBtns">
      {done && <button type="button" className="btn btnGold btnSm" onClick={() => window.print()}>Descarcă PDF</button>}
      {done && <button type="button" className="btn btnGhost btnSm" onClick={() => { void navigator.clipboard?.writeText(location.href); setMsg("Linkul a fost copiat (doar pentru cine are acces la inspecție)."); }}>Copiază linkul</button>}
      {done && !delivered && <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => run({ action: "status", status: "pred" })}>Marchează predată</button>}
      {!done && <a className="btn btnGhost btnSm" href={`/inspectii/nou?id=${id}`}>Editează</a>}
      {canSimulate && !done && <button type="button" className="btn btnGold btnSm" disabled={busy} onClick={() => run({ action: "simulate" })}>Simulează inspecția (test)</button>}
      {done && canReopen && <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => setRedo(!redo)}>Retrimite pe telefon</button>}
      {children}
      {msg && <span className="inDocMsg" role="status">{msg}</span>}
      {redo && (
        <div className="inRedo">
          <b>Retrimite inspecția pe telefon, pentru completare</b>
          <p className="hint">Revine „În lucru” în aplicația {assignee ? `lui ${assignee}` : "de pe telefon"}, cu tot ce s-a completat; primește notificare. Se semnează din nou la final.</p>
          <textarea className="input" rows={3} value={note} placeholder="Ce trebuie completat? ex. fotografii la contoare, anul construcției, suprafața balconului" onChange={(e) => setNote(e.target.value)} />
          <span className="actions">
            <button type="button" className="btn btnGold btnSm" disabled={busy || !note.trim()} onClick={() => run({ action: "reopen", note })}>Trimite pe telefon</button>
            <button type="button" className="btn btnGhost btnSm" onClick={() => setRedo(false)}>Renunță</button>
          </span>
        </div>
      )}
    </div>
  );
}
