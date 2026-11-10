"use client";

import { useState } from "react";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string; token?: string };
  if (!r.ok) throw new Error(j.error || "Nu a mers.");
  return j;
}

/** "Link public": the sheet as a web page anyone with the link can open (no contact data, documents or signature). */
export function InspShare({ id, token: t0 }: { id: string; token: string | null }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(t0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const url = token ? `${typeof location === "undefined" ? "" : location.origin}/fisa/${token}` : "";
  const run = async (on: boolean) => {
    setBusy(true); setMsg("");
    try { const j = await post({ action: "share", id, on }); setToken(on ? j.token ?? null : null); if (!on) setMsg("Linkul a fost oprit."); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={`btn btnSm ${token ? "btnGold" : "btnGhost"}`} onClick={() => setOpen(!open)}>{token ? "Link public · activ" : "Link public"}</button>
      {open && (
        <div className="inRedo inShare">
          <b>Link public către fișă</b>
          <p className="hint">Oricine are linkul vede fișa ca pagină web, fără cont: poza de profil, datele bunului, răspunsurile, încăperile și fotografiile.
            Nu apar persoana de contact, telefonul, actele (CF, releveu) și semnătura. Îl poți opri oricând.</p>
          {token ? <>
            <span className="inShareUrl"><input className="input" readOnly value={url} onFocus={(e) => e.target.select()} /></span>
            <span className="actions">
              <button type="button" className="btn btnGold btnSm" onClick={() => { void navigator.clipboard?.writeText(url); setMsg("Linkul a fost copiat."); }}>Copiază linkul</button>
              <a className="btn btnGhost btnSm" href={url} target="_blank" rel="noopener">Deschide pagina ↗</a>
              {"share" in navigator && <button type="button" className="btn btnGhost btnSm" onClick={() => void navigator.share({ title: "Fișă de inspecție", url }).catch(() => {})}>Trimite…</button>}
              <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => run(false)}>Oprește linkul</button>
            </span>
          </> : <span className="actions"><button type="button" className="btn btnGold btnSm" disabled={busy} onClick={() => run(true)}>Creează linkul public</button></span>}
          {msg && <span className="inDocMsg" role="status">{msg}</span>}
        </div>
      )}
    </>
  );
}

/** On each photo of the sheet: make it the profile photo (shown at the top of the sheet and of the public page). */
export function InspCoverPick({ id, fileId, on }: { id: string; fileId: string; on: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={`inCoverPick${on ? " on" : ""}`} disabled={busy || on} title={on ? "Poza de profil a fișei" : "Folosește ca poză de profil"}
      onClick={async () => { setBusy(true); try { await post({ action: "cover", id, file_id: fileId }); location.reload(); } catch (e) { alert((e as Error).message); setBusy(false); } }}>
      {on ? "★ Poză de profil" : "Alege ca profil"}
    </button>
  );
}
