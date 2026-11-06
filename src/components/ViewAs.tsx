"use client";
// "Vezi ca utilizatorul" (super-admins): an icon-only button next to the avatar in the header (opens the picker as a window)
// and the orange strip shown on every page while viewing.
// The view is read-only: worker.ts refuses every write while the cookie is set; nothing is tracked for the viewed person.
import { useEffect, useRef, useState } from "react";

type U = { id: string; name: string; email: string; anevar_no: string | null; status: string; org: string | null };
const label = (u: U) => `${u.name || u.email}${u.name ? ` · ${u.email}` : ""}${u.org ? ` · ${u.org}` : ""}${u.status !== "active" ? ` · ${u.status === "closed" ? "cont închis" : "dezactivat"}` : ""}`;
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function stop() {
  await fetch("/api/admin/view", { method: "DELETE" }).catch(() => null);
  location.href = "/";
}

/** The header button (no text): opens the window where the person is chosen. */
export function ViewAsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="vaBtn" onClick={() => setOpen(true)} title="Vezi platforma ca un utilizator" aria-label="Vezi platforma ca un utilizator">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {open && <ViewAsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ViewAsModal({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<U[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    fetch("/api/admin/view").then((r) => r.json() as Promise<{ users?: U[] }>).then((d) => setUsers(d.users ?? [])).catch(() => setMsg("Nu am putut încărca lista."));
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  const hits = q.trim().length < 2 ? [] : users.filter((u) => fold(label(u)).includes(fold(q.trim()))).slice(0, 10);
  const go = async (u: U) => {
    setMsg("");
    const r = await fetch("/api/admin/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: u.id }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string };
    if (!r?.ok) return setMsg(d.error ?? "Nu a mers.");
    location.href = "/";
  };
  return (
    <div className="hdModalBg" onClick={onClose}>
      <div className="hdModal vaModal" role="dialog" aria-modal="true" aria-labelledby="vaT" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="hdModalX" aria-label="Închide" onClick={onClose}>×</button>
        <h2 id="vaT">Vezi platforma ca un utilizator</h2>
        <p className="hdMuted">Platforma exact cum o vede persoana aleasă: planul, firma, instrumentele ei. Doar vizualizare: nimic nu se modifică și nu se înregistrează.</p>
        <div className="vaSearch">
          <input className="input" placeholder="Caută după nume, email sau firmă…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoFocus />
          {hits.length > 0 && (
            <ul className="vaHits">
              {hits.map((u) => <li key={u.id}><button type="button" onClick={() => go(u)}>{label(u)}</button></li>)}
            </ul>
          )}
          {q.trim().length >= 2 && !hits.length && users.length > 0 && <small className="muted">Niciun utilizator pentru „{q}”.</small>}
          {q.trim().length < 2 && <small className="muted">{users.length ? `${users.length} conturi · scrie cel puțin două litere` : "Se încarcă lista…"}</small>}
        </div>
        {msg && <small className="muted" role="status">{msg}</small>}
      </div>
    </div>
  );
}

/** The orange strip at the top of every page while viewing as someone else (thin, the layout underneath stays as it is). */
export function ViewAsStrip({ name, email }: { name: string; email: string }) {
  return (
    <div className="vaStrip" role="status">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
      <span>Vezi platforma ca <b>{name}</b> ({email}) · doar vizualizare, nimic nu se modifică.</span>
      <button type="button" onClick={stop}>Ieși din vizualizare</button>
    </div>
  );
}
