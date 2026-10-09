"use client";

import { useState } from "react";

type Found = { status: string; name?: string; county?: string | null; specs?: string | null };

export function RequestForm({ r: refToken, email }: { r?: string; email?: string }) {
  const [legit, setLegit] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [f, setF] = useState({ email: email ?? "", phone: "", company: "", confirm: false });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const look = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = legit.replace(/\D/g, "");
    if (v.length < 3) return setMsg("Introdu numărul legitimației ANEVAR.");
    setBusy(true); setMsg("");
    const r = await fetch("/api/request/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legit: v }) });
    const d = (await r.json().catch(() => ({ status: "error" }))) as Found;
    setBusy(false);
    if (d.status === "not_found") return setMsg("Nu găsim această legitimație în tabloul membrilor titulari ANEVAR. Verifică numărul de pe legitimație.");
    if (d.status === "too_many") return setMsg("Prea multe încercări. Reîncearcă peste o oră.");
    if (d.status === "has_account") return setMsg(`${d.name} are deja cont. Intră cu adresa de email a contului.`);
    if (d.status === "pending") return setMsg(`Pentru ${d.name} există deja o solicitare în așteptare. Te anunțăm pe email când este aprobată.`);
    if (d.status !== "ok") return setMsg("Nu am putut verifica legitimația. Încearcă din nou.");
    setFound(d);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setMsg("Introdu o adresă de email validă.");
    if (!f.confirm) return setMsg(`Confirmă că ești ${found?.name}.`);
    setBusy(true); setMsg("");
    const r = await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legit: legit.replace(/\D/g, ""), ...f, r: refToken }) });
    const d = (await r.json().catch(() => ({}))) as { error?: string; name?: string };
    setBusy(false);
    if (!r.ok) return setMsg(d.error || "Nu am putut trimite solicitarea.");
    setDone(f.email.trim());
  };

  if (done) return (
    <div className="okMsg" role="status" style={{ lineHeight: 1.6 }}>
      Mulțumim, {found?.name}! Solicitarea a fost trimisă. După aprobare primești la <b>{done}</b> linkul de activare a contului.
    </div>
  );

  if (!found) return (
    <form className="authBox" style={{ animation: "none" }} onSubmit={look} noValidate>
      <p>Introdu numărul legitimației de membru titular ANEVAR.</p>
      <label className="field">Nr. legitimație ANEVAR
        <input className="input codeInput" inputMode="numeric" value={legit} onChange={(e) => setLegit(e.target.value.replace(/[^\d]/g, ""))} placeholder="ex. 18923" maxLength={7} autoFocus />
      </label>
      {msg && <div role="alert" className="error">{msg}</div>}
      <button type="submit" className="btn btnNavy" style={{ height: 52 }} disabled={busy}>{busy ? "Se caută…" : "Continuă"}</button>
    </form>
  );

  return (
    <form className="authBox" style={{ animation: "none" }} onSubmit={send} noValidate>
      <div className="note" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="muted" style={{ fontSize: 12 }}>Din tabloul ANEVAR · legitimația {legit}</span>
        <b style={{ fontSize: 17 }}>{found.name}</b>
        <span>{[found.county, found.specs?.split(",").join(" · ")].filter(Boolean).join(" · ")}</span>
      </div>
      <label className="check"><input type="checkbox" checked={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.checked })} /><span>Confirm că sunt <b>{found.name}</b>, titularul acestei legitimații.</span></label>
      <label className="field">Adresa de email pentru cont<input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nume@exemplu.ro" /></label>
      <label className="field"><span>Telefon mobil</span><input className="input" type="tel" autoComplete="tel" placeholder="07xx xxx xxx" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label className="field"><span>Firma de evaluare <small>(opțional)</small></span><input className="input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
      {msg && <div role="alert" className="error">{msg}</div>}
      <button type="submit" className="btn btnNavy" style={{ height: 52 }} disabled={busy}>{busy ? "Se trimite…" : "Solicită contul gratuit"}</button>
      <button type="button" className="linkBtn" onClick={() => { setFound(null); setMsg(""); }}>← Altă legitimație</button>
    </form>
  );
}
