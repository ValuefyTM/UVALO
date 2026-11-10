"use client";

import { useEffect, useRef, useState } from "react";
import { TeamPick, type TeamPerson } from "./InspForm";

/**
 * „Șterge fișa” (fișa web): fișa e o înregistrare a bunului și se poate șterge — răspunsurile, încăperile, constatările, semnătura
 * (și, la alegere, fotografiile). Bunul, contactul, actele și istoricul rămân; o copie a fișei șterse se păstrează. Apoi inspecția
 * rămâne la cine o avea sau se dă altcuiva (Eu / cineva din birou). Fișa nouă primește alt număr când începe să fie completată.
 */
export function InspSheetDelete({ id, no, photos, team, current, currentName, canMe, when, dur }: {
  id: string; no: string | null; photos: number; team: TeamPerson[]; current: string | null; currentName: string | null; canMe: boolean; when: string | null; dur: number;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("keep");
  const [withPhotos, setWithPhotos] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dlg.current?.showModal?.(); }, [open]);
  const others = team.filter((p) => p.id !== current);
  const save = async () => {
    if (!confirm(`Ștergi fișa${no ? ` ${no}` : ""}? Răspunsurile${withPhotos ? ", fotografiile" : ""} și semnătura nu se mai văd la inspecție.`)) return;
    setBusy(true); setMsg("");
    const who = pick === "keep" ? {} : pick === "me" ? { assignee_kind: "me" } : { assignee_kind: "office", assignee_id: pick };
    const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sheet_delete", id, photos: withPhotos, reason, ...who }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!r?.ok) { setMsg(j?.error || "Nu a mers. Încearcă din nou."); setBusy(false); return; }
    location.reload();
  };
  return (
    <>
      <button type="button" className="btn btnGhost btnSm btnDangerText" onClick={() => setOpen(true)}>Șterge fișa</button>
      {open && (
        <dialog ref={dlg} className="modal opDlg" aria-labelledby="sdT" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
          <div className="modalBox">
            <button type="button" className="modalX" aria-label="Închide" onClick={() => dlg.current?.close()}>×</button>
            <h2 id="sdT">Șterge fișa{no ? ` ${no}` : ""}</h2>
            <p className="hint" style={{ margin: 0 }}>Se șterg răspunsurile, încăperile, constatările și semnătura. Bunul, persoana de contact, actele și istoricul rămân;
              o copie a fișei șterse se păstrează. Inspecția se poate face din nou: fișa nouă primește alt număr când începe să fie completată.</p>
            <label className="field">Motivul (opțional)<input className="input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="ex. completată la alt bun, se reface inspecția" /></label>
            {photos > 0 && (
              <label className="check"><input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} /> Șterge și fotografiile ({photos})</label>
            )}
            <b className="sdCap">Cine face inspecția din nou</b>
            <button type="button" className={`tpRow${pick === "keep" ? " on" : ""}`} onClick={() => setPick("keep")}><i className="tpRadio" aria-hidden="true" />
              <span className="tpName"><b>{currentName ? `Rămâne la ${currentName}` : "Rămâne nealocată"}</b><small>{currentName ? "o primește din nou pe telefon, cu fișa goală" : "o aloci mai târziu"}</small></span></button>
            {canMe && current && (
              <button type="button" className={`tpRow${pick === "me" ? " on" : ""}`} onClick={() => setPick("me")}><i className="tpRadio" aria-hidden="true" /><span className="tpName"><b>Eu</b><small>o fac eu</small></span></button>
            )}
            {others.length > 0 && <div className="raList"><TeamPick team={others} value={pick === "me" || pick === "keep" ? "" : pick} onPick={setPick} date={when?.slice(0, 10) ?? ""} time={when?.slice(11, 16) ?? ""} dur={dur} selfId={id} /></div>}
            {msg && <div role="alert" className="error">{msg}</div>}
            <div className="modalActions">
              <button type="button" className="btn btnGhost" onClick={() => dlg.current?.close()}>Renunță</button>
              <button type="button" className="btn btnDanger" disabled={busy} onClick={save}>{busy ? "Se șterge…" : "Șterge fișa"}</button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
