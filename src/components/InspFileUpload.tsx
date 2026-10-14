"use client";

import { useRef, useState } from "react";

/** Adds documents or photos to an inspection (private bucket); used on the inspection page. */
export function InspFileUpload({ id, kind, label, accept = "application/pdf,image/jpeg,image/png,image/webp", multiple = false }:
  { id: string; kind: "cf" | "releveu" | "doc" | "photo"; label: string; accept?: string; multiple?: boolean }) {
  const inp = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function send(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg("");
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("id", id); fd.append("kind", kind); fd.append("file", f); fd.append("name", f.name);
        if (kind === "photo") fd.append("taken_at", new Date(f.lastModified || Date.now()).toISOString());
        const r = await fetch("/api/inspectii/files", { method: "POST", body: fd });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error || "Fișierul nu a putut fi încărcat.");
      }
      location.reload();
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  }
  return (
    <span className="inUp inNoPrint">
      <input ref={inp} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { void send(e.target.files); e.target.value = ""; }} />
      <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => inp.current?.click()}>{busy ? "Se încarcă…" : label}</button>
      {msg && <small role="alert">{msg}</small>}
    </span>
  );
}

/** Removes a file (owner / the one doing the inspection). */
export function InspFileDelete({ id }: { id: string }) {
  return (
    <button type="button" className="inFileX inNoPrint" aria-label="Șterge fișierul" onClick={async () => {
      if (!confirm("Ștergi fișierul?")) return;
      await fetch(`/api/inspectii/file/${id}`, { method: "DELETE" });
      location.reload();
    }}>×</button>
  );
}
