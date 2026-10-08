"use client";

import { useState } from "react";

export function AcceptForm({ token, name: n0, phone: p0, legit, county }: { token: string; name: string; phone: string; legit: string | null; county: string | null }) {
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
      {legit ? (
        <div className="note" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>Din tabloul ANEVAR · legitimația {legit}{county ? ` · ${county}` : ""}</span>
          <b style={{ fontSize: 17 }}>{n0}</b>
        </div>
      ) : (
        <label className="field">Nume și prenume<input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      )}
      <label className="field"><span>Telefon mobil</span><input className="input" type="tel" placeholder="07xx xxx xxx" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
      {!legit && <label className="field"><span>Nr. legitimație ANEVAR <small>(opțional)</small></span><input className="input" inputMode="numeric" value={anevar} onChange={(e) => setAnevar(e.target.value)} /></label>}
      <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>Accept termenii de utilizare: contul este personal și nu se împarte cu alte persoane; activitatea din platformă este înregistrată pentru securitate și statistici; datele cadastrale au caracter orientativ.</span>
      </label>
      {msg && <div role="alert" className="error">{msg}</div>}
      <button type="submit" className="btn btnNavy" style={{ height: 52 }} disabled={busy}>{busy ? "Se activează…" : "Activează contul"}</button>
    </form>
  );
}
