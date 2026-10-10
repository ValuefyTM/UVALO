"use client";

import { useState } from "react";

/** "Anunță-mă" for an upcoming module: remembered on the account, so it stays pressed. */
export function NotifyButton({ k, done: initial }: { k: string; done: boolean }) {
  const [done, setDone] = useState(initial);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await fetch("/api/interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) setDone(true);
  };
  return done ? (
    <span className="soonBtn on" role="status">✓ Te anunțăm</span>
  ) : (
    <button type="button" className="soonBtn" onClick={go} disabled={busy}>{busy ? "Se salvează…" : "Anunță-mă"}</button>
  );
}
