"use client";

import { useState } from "react";

/**
 * „Șterge inspecția”: doar cine a pregătit-o (sau firma ei). Ștergerea e logică (`deleted_at`): iese din liste, de pe telefon și de pe
 * hartă; cel care o face primește notificare. `icon` = butonul mic din lista de inspecții; altfel butonul din bara fișei.
 */
export function InspDelete({ id, address, done, icon = false, onDeleted }: { id: string; address: string; done: boolean; icon?: boolean; onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false);
  const del = async () => {
    const warn = done ? "\n\nInspecția e finalizată: fișa, fotografiile și actele nu se mai văd." : "\n\nDacă e la cineva pe telefon, dispare și de acolo.";
    if (!confirm(`Ștergi inspecția „${address}”?${warn}`)) return;
    setBusy(true);
    const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!r?.ok) { alert(j?.error || "Nu am putut șterge inspecția."); return; }
    if (onDeleted) onDeleted(); else location.href = "/inspectii";
  };
  return icon ? (
    <button type="button" className="inDelIco" disabled={busy} onClick={del} aria-label={`Șterge inspecția ${address}`} title="Șterge inspecția">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
    </button>
  ) : (
    <button type="button" className="btn btnGhost btnSm btnDangerText" disabled={busy} onClick={del}>{busy ? "Se șterge…" : "Șterge inspecția"}</button>
  );
}
