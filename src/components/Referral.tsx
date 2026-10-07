"use client";

import { useRef, useState } from "react";

/** "Recomandă unui coleg": small sticker (menu, or a card on the phone) that opens a form in a modal. */
export function Referral({ variant = "side" }: { variant?: "side" | "card" }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState({ email: "", name: "", note: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const open = () => { setMsg(""); dlg.current?.showModal(); };
  const close = () => { dlg.current?.close(); if (done) { setDone(""); setF({ email: "", name: "", note: "" }); } };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setMsg("Introdu adresa de email a colegului.");
    setBusy(true); setMsg("");
    const r = await fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!r?.ok) return setMsg(d?.error || "Nu am putut trimite recomandarea. Încearcă din nou.");
    setDone(f.name.trim() || f.email.trim());
  };

  return (
    <>
      {variant === "side" ? (
        <button type="button" className="refSticker" onClick={open}>
          <span className="refIcon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M19 8v6M16 11h6" /></svg>
          </span>
          <span><b>Recomandă unui coleg</b><small>Invită un evaluator ANEVAR în VALUEFY Tools</small></span>
        </button>
      ) : (
        <button type="button" className="tool refCard" onClick={open}>
          <span className="eyebrow">Recomandă</span>
          <h2>Ai un coleg evaluator?</h2>
          <p>Trimite-i invitația: își solicită cont cu legitimația ANEVAR și îl activăm după verificare.</p>
          <span className="go">Recomandă unui coleg →</span>
        </button>
      )}

      <dialog ref={dlg} className="modal" aria-labelledby="refTitle" onClick={(e) => { if (e.target === dlg.current) close(); }} onClose={() => done && close()}>
        <div className="modalBox">
          <button type="button" className="modalX" aria-label="Închide" onClick={close}>×</button>
          {done ? (
            <div className="refDone" role="status">
              <span className="refHeart" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.6 5c2.1 0 3.5 1.1 4.4 2.5C11.9 6.1 13.3 5 15.4 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21z" /></svg>
              </span>
              <h2 id="refTitle">Mulțumim pentru recomandare!</h2>
              <p><b>{done}</b> a primit pe email invitația de a-și solicita cont în VALUEFY Tools. După ce verificăm legitimația ANEVAR, îi activăm contul.</p>
              <p className="muted">Ținem evidența recomandărilor tale și vom ține cont de ele la momentul potrivit.</p>
              <div className="modalActions">
                <button type="button" className="btn btnGhost" onClick={() => { setDone(""); setF({ email: "", name: "", note: "" }); }}>Recomandă încă un coleg</button>
                <button type="button" className="btn btnNavy" onClick={close}>Închide</button>
              </div>
            </div>
          ) : (
            <form onSubmit={send} noValidate className="modalForm">
              <span className="eyebrow">VALUEFY Tools</span>
              <h2 id="refTitle">Recomandă unui coleg</h2>
              <p className="muted">Colegul primește pe email un link prin care își solicită cont cu numărul legitimației ANEVAR. Contul se activează după aprobare.</p>
              <label className="field">Emailul colegului<input className="input" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="coleg@exemplu.ro" autoFocus /></label>
              <label className="field"><span>Numele colegului <small>(opțional)</small></span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <label className="field"><span>Un mesaj pentru el <small>(opțional)</small></span><textarea className="input" rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="ex. Îl folosesc la inspecții, merită încercat." /></label>
              {msg && <div role="alert" className="error">{msg}</div>}
              <div className="modalActions">
                <button type="button" className="btn btnGhost" onClick={close}>Renunță</button>
                <button type="submit" className="btn btnNavy" disabled={busy}>{busy ? "Se trimite…" : "Trimite invitația"}</button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
