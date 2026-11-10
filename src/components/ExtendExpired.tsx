"use client";

// Admin → Firme: „Prelungește toate firmele expirate” — the active firms whose "Acces până la" has passed get no end date again.
import { useState } from "react";

export function ExtendExpired({ n }: { n: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!n) return null;
  const go = async () => {
    if (!confirm(`Prelungești accesul pentru ${n === 1 ? "firma expirată" : `cele ${n} firme expirate`}? „Acces până la” devine gol (fără termen), iar utilizatorii lor își recapătă modulele imediat.`)) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/orgs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "extend_expired" }) })
      .then((x) => x.json().then((v: unknown) => ({ ok: x.ok, j: v as { n?: number; error?: string } }))).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg(r?.j.error || "Nu a mers. Încearcă din nou.");
    location.reload();
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button type="button" className="btn btnGold btnSm" disabled={busy} onClick={go} title="Firmele active cu „Acces până la” în trecut primesc acces fără termen">
        Prelungește toate firmele expirate · {n}
      </button>
      {msg && <small className="error" role="alert">{msg}</small>}
    </span>
  );
}
