"use client";

import { useState } from "react";

export function AcceptForm({ token, name: n0, phone: p0 }: { token: string; name: string; phone: string }) {
  const [name, setName] = useState(n0);
  const [phone, setPhone] = useState(p0);
  const [anevar, setAnevar] = useState("");
  const [terms, setTerms] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="authBox" style={{ animation: "none" }} noValidate onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setMsg("");
      const r = await fetch("/api/invite/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, phone, anevar, terms }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setBusy(false); return setMsg(d.error || "Nu am putut activa contul."); }
      location.href = "/";
    }}>
      <label className="field">Nume și prenume<input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <label className="field"><span>Telefon <small>(opțional)</small></span><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
      <label className="field"><span>Nr. legitimație ANEVAR <small>(opțional)</small></span><input className="input" value={anevar} onChange={(e) => setAnevar(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>Accept termenii de utilizare: contul este personal și nu se împarte cu alte persoane; activitatea din platformă este înregistrată pentru securitate și statistici; datele cadastrale au caracter orientativ.</span>
      </label>
      {msg && <div role="alert" className="error">{msg}</div>}
      <button type="submit" className="btn btnNavy" style={{ height: 52 }} disabled={busy}>{busy ? "Se activează…" : "Activează contul"}</button>
    </form>
  );
}
