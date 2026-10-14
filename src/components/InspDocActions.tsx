"use client";

import { useState } from "react";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(j.error || "Nu a mers.");
  return j;
}

/** The inspection document's buttons: PDF (print), link, mark as delivered, and in test mode "simulate the phone". */
export function InspDocActions({ id, done, delivered, canSimulate }: { id: string; done: boolean; delivered: boolean; canSimulate: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
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
      {msg && <span className="inDocMsg" role="status">{msg}</span>}
    </div>
  );
}
