"use client";

// Suport tehnic: the new-ticket form (subject, message, photo) and the chat composer of a thread (the person, or the UVALO
// team in admin). Images are shrunk in the browser (≤ 1600 px, JPEG) before upload, so a phone screenshot stays small.
import { useRef, useState } from "react";

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

const ImgIco = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></svg>;
const SendIco = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg>;

function usePick() {
  const inp = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const take = async (f: File | undefined) => { if (!f) return; const s = await shrinkImage(f); setFile(s); setUrl(URL.createObjectURL(s)); };
  const clear = () => { setFile(null); setUrl(null); };
  const input = <input ref={inp} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />;
  return { inp, file, url, take, clear, input };
}

async function post(url: string, fd: FormData) {
  return fetch(url, { method: "POST", body: fd }).then((x) => x.json().then((v: unknown) => ({ ok: x.ok, j: v as { error?: string; id?: number } }))).catch(() => null);
}

/** /suport/nou: subject, message, a photo → POST /api/feedback (multipart), then the chat. */
export function TicketForm() {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const pk = usePick();
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 3) return setMsg("Descrie problema în câteva cuvinte.");
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.set("kind", "problema"); fd.set("subject", subject); fd.set("text", text); fd.set("page", "/suport");
    if (pk.file) fd.set("image", pk.file);
    const r = await post("/api/feedback", fd);
    setBusy(false);
    if (!r?.ok) return setMsg(r?.j.error || "Nu am putut trimite. Încearcă din nou.");
    location.href = `/suport/${r.j.id}`;
  };
  return (
    <form className="spForm" onSubmit={send} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pk.take(e.dataTransfer.files?.[0]); }}>
      <label className="field"><span>Subiect</span><input className="input" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="ex. Nu se încarcă pozele în anexă" /></label>
      <label className="field"><span>Mesaj</span><textarea className="textarea" rows={5} required maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Descrie problema…" /></label>
      {pk.input}
      {pk.file && pk.url ? (
        <div className="spAttach">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="spPrev" src={pk.url} alt="" /><span>{pk.file.name} · {Math.max(1, Math.round(pk.file.size / 1024))} KB</span>
          <button type="button" className="linkBtn" onClick={pk.clear}>Scoate</button>
        </div>
      ) : <button type="button" className="spPick" onClick={() => pk.inp.current?.click()}><ImgIco />Atașează o poză (opțional)</button>}
      {msg && <div className="error" role="alert">{msg}</div>}
      <button type="submit" className="btn btnPri spBig" disabled={busy}>{busy ? "Se trimite…" : <><SendIco />Trimite</>}</button>
    </form>
  );
}

/** The composer at the bottom of a chat: a photo button, the message, send. The person (`/api/suport/<id>`) or the team (`/api/admin/feedback/<id>/reply`). */
export function Composer({ id, staff }: { id: number; staff?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const pk = usePick();
  const send = async () => {
    if (text.trim().length < 2 && !pk.file) return setMsg("Scrie mesajul.");
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.set("text", text.trim() || "(imagine)");
    if (pk.file) fd.set("image", pk.file);
    const r = await post(staff ? `/api/admin/feedback/${id}/reply` : `/api/suport/${id}`, fd);
    setBusy(false);
    if (!r?.ok) return setMsg(r?.j.error || "Nu am putut trimite. Încearcă din nou.");
    location.reload();
  };
  return (
    <div className="spCompose" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pk.take(e.dataTransfer.files?.[0]); }}>
      {pk.file && pk.url && (
        <div className="spAttach">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="spPrev" src={pk.url} alt="" /><span>{pk.file.name}</span>
          <button type="button" className="linkBtn" onClick={pk.clear}>Scoate</button>
        </div>
      )}
      {msg && <div className="error" role="alert">{msg}</div>}
      <form className="spComposeRow" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {pk.input}
        <button type="button" className="spRound spRoundGhost" aria-label="Atașează o imagine" title="Atașează o captură de ecran sau o poză" onClick={() => pk.inp.current?.click()}><ImgIco /></button>
        <textarea className="spInput" rows={1} value={text} maxLength={4000} aria-label={staff ? "Răspunsul echipei UVALO" : "Mesajul tău"} placeholder={staff ? "Răspunsul echipei UVALO…" : "Scrie un mesaj…"}
          onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <button type="submit" className="spRound" aria-label="Trimite" disabled={busy}><SendIco /></button>
      </form>
    </div>
  );
}
