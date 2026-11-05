"use client";

// Suport tehnic: the new-ticket form (kind, text, screenshot) and the reply form in a thread (the person, or the UVALO team in
// admin). Images are shrunk in the browser (≤ 1600 px, JPEG) before upload, so a phone screenshot stays small.
import { useRef, useState } from "react";
import { SUPPORT_KINDS } from "@/lib/support-shared";

async function shrinkImage(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type) || f.size < 400 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise<File>((res) => cv.toBlob((b) => res(b ? new File([b], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f), "image/jpeg", 0.86));
  } catch { return f; }
}

function Attach({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const inp = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const take = async (f: File | undefined) => {
    if (!f) return;
    const s = await shrinkImage(f);
    onFile(s); setUrl(URL.createObjectURL(s));
  };
  return (
    <div className="spAttach" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void take(e.dataTransfer.files?.[0]); }}>
      <input ref={inp} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
      {file && url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="spPrev" src={url} alt="" />
          <span>{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</span>
          <button type="button" className="linkBtn" onClick={() => { onFile(null); setUrl(null); }}>Scoate</button>
        </>
      ) : (
        <button type="button" className="spDrop" onClick={() => inp.current?.click()}>+ Adaugă o captură de ecran sau o poză</button>
      )}
      {!file && <span>JPG, PNG, WebP · se micșorează automat</span>}
    </div>
  );
}

/** A new ticket → POST /api/feedback (multipart), then the thread page. */
export function TicketForm() {
  const [kind, setKind] = useState("problema");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 3) return setMsg("Scrie câteva cuvinte.");
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.set("kind", kind); fd.set("text", text); fd.set("page", "/suport");
    if (file) fd.set("image", file);
    const r = await fetch("/api/feedback", { method: "POST", body: fd }).then((x) => x.json().then((v: unknown) => ({ ok: x.ok, j: v as { error?: string; id?: number } }))).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg(r?.j.error || "Nu am putut trimite. Încearcă din nou.");
    location.href = `/suport/${r.j.id}`;
  };
  return (
    <form className="spForm" onSubmit={send}>
      <div className="spKinds" role="group" aria-label="Tipul sesizării">
        {Object.entries(SUPPORT_KINDS).map(([k, l]) => <button key={k} type="button" className={`svChip${kind === k ? " on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <textarea className="textarea" rows={4} required maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Mesajul tău"
        placeholder={kind === "idee" ? "Ce ai vrea să adăugăm sau să schimbăm…" : kind === "problema" ? "Ce nu merge, unde și ce ai încercat…" : "Scrie-ne…"} />
      <Attach file={file} onFile={setFile} />
      {msg && <div className="error" role="alert">{msg}</div>}
      <div className="actions"><button type="submit" className="btn btnNavy" disabled={busy}>{busy ? "Se trimite…" : "Trimite sesizarea"}</button><span className="hint" style={{ fontSize: 12 }}>Primești răspunsul aici și pe email.</span></div>
    </form>
  );
}

/** A reply in a thread: the person (`/api/suport/<id>`) or the UVALO team (`/api/admin/feedback/<id>/reply`). */
export function ReplyForm({ id, staff }: { id: number; staff?: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 2) return setMsg("Scrie mesajul.");
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.set("text", text);
    if (file) fd.set("image", file);
    const r = await fetch(staff ? `/api/admin/feedback/${id}/reply` : `/api/suport/${id}`, { method: "POST", body: fd }).then((x) => x.json().then((v: unknown) => ({ ok: x.ok, j: v as { error?: string } }))).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg(r?.j.error || "Nu am putut trimite. Încearcă din nou.");
    location.reload();
  };
  return (
    <form className="spForm" onSubmit={send}>
      <textarea className="textarea" rows={3} required maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Răspunsul tău" placeholder={staff ? "Răspunsul echipei UVALO (persoana îl primește și pe email)…" : "Scrie înapoi…"} />
      <Attach file={file} onFile={setFile} />
      {msg && <div className="error" role="alert">{msg}</div>}
      <div className="actions"><button type="submit" className="btn btnNavy" disabled={busy}>{busy ? "Se trimite…" : staff ? "Trimite răspunsul" : "Trimite"}</button></div>
    </form>
  );
}
