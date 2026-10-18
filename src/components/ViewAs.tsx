"use client";
// "Vezi ca utilizatorul" (super-admins): the picker on the home page and the strip shown on every page while viewing.
// The view is read-only: worker.ts refuses every write while the cookie is set; nothing is tracked for the viewed person.
import { useEffect, useState } from "react";

type U = { id: string; name: string; email: string; anevar_no: string | null; status: string; org: string | null };
const label = (u: U) => `${u.name || u.email}${u.name ? ` · ${u.email}` : ""}${u.org ? ` · ${u.org}` : ""}${u.status !== "active" ? ` · ${u.status === "closed" ? "cont închis" : "dezactivat"}` : ""}`;

async function stop() {
  await fetch("/api/admin/view", { method: "DELETE" }).catch(() => null);
  location.href = "/";
}

/** On the home page: choose the person; while viewing, who it is and the way out. */
export function ViewAsPicker({ current }: { current: { id: string; name: string } | null }) {
  const [users, setUsers] = useState<U[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(!!current);
  useEffect(() => { if (open && !users.length) fetch("/api/admin/view").then((r) => r.json() as Promise<{ users?: U[] }>).then((d) => setUsers(d.users ?? [])).catch(() => null); }, [open, users.length]);
  const hits = q.trim().length < 2 ? [] : users.filter((u) => label(u).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))).slice(0, 8);
  const go = async (u: U) => {
    setMsg("");
    const r = await fetch("/api/admin/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: u.id }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string };
    if (!r?.ok) return setMsg(d.error ?? "Nu a mers.");
    location.href = "/";
  };
  if (!open) return <button type="button" className="vaOpen" onClick={() => setOpen(true)}>Vezi platforma ca un utilizator</button>;
  return (
    <section className="card vaCard" aria-label="Vezi ca utilizatorul">
      <div className="vaHead">
        <span className="eyebrow">Vezi ca utilizatorul</span>
        {current ? <span className="hint">Acum vezi platforma ca <b>{current.name}</b> · doar vizualizare</span> : <span className="hint">Platforma exact cum o vede persoana aleasă: planul, firma, instrumentele ei. Doar vizualizare: nimic nu se modifică și nu se înregistrează.</span>}
        {current ? <button type="button" className="btn btnGhost btnSm" onClick={stop}>Ieși din vizualizare</button> : <button type="button" className="lnk" onClick={() => setOpen(false)}>Ascunde</button>}
      </div>
      <div className="vaSearch">
        <input className="input" placeholder="Caută după nume, email sau firmă…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        {hits.length > 0 && (
          <ul className="vaHits">
            {hits.map((u) => <li key={u.id}><button type="button" onClick={() => go(u)}>{label(u)}</button></li>)}
          </ul>
        )}
        {q.trim().length >= 2 && !hits.length && users.length > 0 && <small className="muted">Niciun utilizator pentru „{q}”.</small>}
      </div>
      {msg && <small className="muted" role="status">{msg}</small>}
    </section>
  );
}

/** The strip at the top of every page while viewing as someone else. */
export function ViewAsStrip({ name, email }: { name: string; email: string }) {
  return (
    <div className="vaStrip" role="status">
      Vezi platforma ca <b>{name}</b> ({email}) · doar vizualizare, nimic nu se modifică.
      <button type="button" onClick={stop}>Ieși din vizualizare</button>
    </div>
  );
}
