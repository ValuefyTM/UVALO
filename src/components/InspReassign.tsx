"use client";

import { useEffect, useRef, useState } from "react";
import { TeamPick, type TeamPerson } from "./InspForm";

/**
 * „Realocă inspectorul” (fișa web, cât timp inspecția nu e făcută): alege altcineva din birou sau „Eu”. Ce s-a completat pe telefon,
 * pozele și actele rămân; cel nou primește notificare, cel vechi află că nu mai e a lui. Unui colaborator i se trimite o solicitare.
 */
export function InspReassign({ id, team, current, canMe, when, dur, started }: {
  id: string; team: TeamPerson[]; current: string | null; canMe: boolean; when: string | null; dur: number; started: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dlg.current?.showModal?.(); }, [open]);
  const others = team.filter((p) => p.id !== current);
  const save = async () => {
    setBusy(true); setMsg("");
    const body = pick === "me" ? { action: "reassign", id, assignee_kind: "me" } : { action: "reassign", id, assignee_kind: "office", assignee_id: pick };
    const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!r?.ok) { setMsg(j?.error || "Nu a mers. Încearcă din nou."); setBusy(false); return; }
    location.reload();
  };
  if (!others.length && !canMe) return null;
  return (
    <>
      <button type="button" className="btn btnGhost btnSm" onClick={() => setOpen(true)}>Realocă inspectorul</button>
      {open && (
        <dialog ref={dlg} className="modal opDlg" aria-labelledby="raT" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
          <div className="modalBox">
            <button type="button" className="modalX" aria-label="Închide" onClick={() => dlg.current?.close()}>×</button>
            <h2 id="raT">Realocă inspectorul</h2>
            <p className="hint" style={{ margin: 0 }}>{started ? "Inspecția a fost începută: ce s-a completat, pozele și actele rămân, iar noul inspector continuă de acolo." : "Noul inspector o primește pe telefon, cu notificare."} Cel de acum află că nu mai e a lui.</p>
            {canMe && current && (
              <button type="button" className={`tpRow${pick === "me" ? " on" : ""}`} onClick={() => setPick("me")}><i className="tpRadio" aria-hidden="true" /><span className="tpName"><b>Eu</b><small>o fac eu</small></span></button>
            )}
            {others.length > 0 && <div className="raList"><TeamPick team={others} value={pick === "me" ? "" : pick} onPick={setPick} date={when?.slice(0, 10) ?? ""} time={when?.slice(11, 16) ?? ""} dur={dur} selfId={id} /></div>}
            {msg && <div role="alert" className="error">{msg}</div>}
            <div className="modalActions">
              <button type="button" className="btn btnGhost" onClick={() => dlg.current?.close()}>Renunță</button>
              <button type="button" className="btn btnNavy" disabled={busy || !pick} onClick={save}>{busy ? "Se salvează…" : "Realocă"}</button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
