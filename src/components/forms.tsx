"use client";

import { useState } from "react";

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
  return r?.ok ? null : d?.error || "Nu am putut salva. Încearcă din nou.";
}

const ROLES: [string, string][] = [["member", "Membru"], ["admin", "Administrator"], ["owner", "Titular cont"]];

export type MemberRow = {
  user_id: string; email: string; name: string; status: string; role: string; last_seen: string; events_30: number; searches_30: number; exports_30: number; me: boolean;
};
export type InviteRow = { id: string; email: string; role: string; created: string; expires: string; by: string | null };

/** Members of a firm: invite within the seats, change role, remove; pending invitations. */
export function MembersPanel({ org, members, invites, seats, used, canOwner, admin }: {
  org?: string; members: MemberRow[]; invites: InviteRow[]; seats: number; used: number; canOwner: boolean; admin?: boolean;
}) {
  const [f, setF] = useState({ email: "", name: "", role: "member" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const q = org ? `?org=${encodeURIComponent(org)}` : "";
  const full = used >= seats;
  const act = async (fn: () => Promise<string | null>, ok?: string) => {
    setBusy(true); setMsg(null);
    const e = await fn();
    setBusy(false);
    if (e) return setMsg({ ok: false, t: e });
    if (ok) setMsg({ ok: true, t: ok });
    setTimeout(() => location.reload(), ok ? 900 : 0);
  };
  return (
    <section className="card">
      <div className="cardHead">
        <h2>Utilizatori <span className="muted">· {used} din {seats} locuri ocupate</span></h2>
      </div>
      <form className="inlineForm2" onSubmit={(e) => { e.preventDefault(); act(() => send(`/api/org/members${q}`, "POST", { ...f, org }), `Invitația a fost trimisă la ${f.email}.`); }}>
        <label className="field">Email<input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nume@firma.ro" required /></label>
        <label className="field">Nume <small>(opțional)</small><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field" style={{ maxWidth: 190 }}>Rol
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {ROLES.filter(([k]) => k !== "owner" || canOwner).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btnNavy" disabled={busy || full} title={full ? "Toate locurile sunt ocupate" : undefined}>Invită</button>
      </form>
      {full && <div className="note">Toate locurile abonamentului sunt ocupate. {admin ? "Mărește numărul de locuri al firmei ca să inviți pe altcineva." : "Scoate pe cineva sau scrie-ne pentru locuri în plus."}</div>}
      {msg && <div role={msg.ok ? "status" : "alert"} className={msg.ok ? "okMsg" : "error"}>{msg.t}</div>}
      <div className="tableWrap">
        <table className="table">
          <thead><tr><th>Persoană</th><th>Rol</th><th>Ultima activitate</th><th className="r">Căutări 30 zile</th><th className="r">Exporturi 30 zile</th><th /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td><b className="block">{m.name || m.email}{m.me && <span className="muted"> (tu)</span>}</b><span className="muted">{m.email}</span>{m.status !== "active" && <span className={`pill ${m.status === "disabled" ? "pillErr" : "pillWarn"}`} style={{ marginLeft: 8 }}><i />{m.status === "disabled" ? "Dezactivat" : "Invitat"}</span>}</td>
                <td>
                  {m.me || (m.role === "owner" && !canOwner) ? ROLES.find(([k]) => k === m.role)?.[1] : (
                    <select className="select" style={{ height: 36 }} value={m.role} disabled={busy} aria-label={`Rolul lui ${m.name || m.email}`}
                      onChange={(e) => act(() => send(`/api/org/members${q}`, "PATCH", { org, user: m.user_id, role: e.target.value }))}>
                      {ROLES.filter(([k]) => k !== "owner" || canOwner).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  )}
                </td>
                <td>{m.last_seen}</td>
                <td className="r mono">{m.searches_30}</td>
                <td className="r mono">{m.exports_30}</td>
                <td className="r">{!m.me && (m.role !== "owner" || canOwner) && (
                  <button type="button" className="linkBtn danger" disabled={busy} onClick={() => { if (confirm(`Scoți pe ${m.name || m.email} din firmă? Nu mai are acces la instrumente.`)) act(() => send(`/api/org/members${q}${q ? "&" : "?"}user=${m.user_id}`, "DELETE")); }}>Scoate</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invites.length > 0 && (
        <>
          <div className="section">Invitații în așteptare</div>
          <ul className="docList">
            {invites.map((i) => (
              <li key={i.id}>
                <span className="who"><b>{i.email}</b><small>{ROLES.find(([k]) => k === i.role)?.[1]} · trimisă {i.created}{i.by ? ` de ${i.by}` : ""} · expiră {i.expires}</small></span>
                <button type="button" className="linkBtn" disabled={busy} onClick={() => act(() => send(`/api/org/members${q}`, "POST", { org, resend: i.id }), "Invitația a fost retrimisă.")}>Retrimite</button>
                <button type="button" className="linkBtn danger" disabled={busy} onClick={() => act(() => send(`/api/org/members${q}`, "POST", { org, cancel: i.id }))}>Anulează</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export type OrgValues = { name: string; cui: string; city: string; plan_id: string; seats: number; valid_until: string; status: string; billing_email: string; notes: string };

/** Firm details and subscription (VALUEFY). New firm: also its owner, invited right away. */
export function OrgForm({ id, initial, plans }: { id?: string; initial?: Partial<OrgValues>; plans: { id: string; name: string }[] }) {
  const [f, setF] = useState<OrgValues & { owner_email: string; owner_name: string }>({
    name: "", cui: "", city: "", plan_id: "trial", seats: 1, valid_until: "", status: "active", billing_email: "", notes: "", owner_email: "", owner_name: "", ...initial,
  });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const r = await fetch(id ? `/api/admin/orgs/${id}` : "/api/admin/orgs", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; id?: string };
      setBusy(false);
      if (!r.ok) return setMsg({ ok: false, t: d.error || "Nu am putut salva." });
      if (!id && d.id) location.href = `/admin/firme/${d.id}`;
      else setMsg({ ok: true, t: "Modificările au fost salvate." });
    }}>
      <h2>{id ? "Firma și abonamentul" : "Firmă nouă"}</h2>
      <div className="grid2">
        <label className="field">Denumire *<input className="input" value={f.name} onChange={set("name")} /></label>
        <label className="field">CUI<input className="input" value={f.cui} onChange={set("cui")} /></label>
        <label className="field">Localitate<input className="input" value={f.city} onChange={set("city")} /></label>
        <label className="field">Email facturare<input className="input" type="email" value={f.billing_email} onChange={set("billing_email")} /></label>
        <label className="field">Plan<select className="select" value={f.plan_id} onChange={set("plan_id")}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="field">Locuri (utilizatori)<input className="input" type="number" min={1} max={500} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} /></label>
        <label className="field"><span>Acces până la <small>(gol = fără termen)</small></span><input className="input" type="date" value={f.valid_until} onChange={set("valid_until")} /></label>
        <label className="field">Stare<select className="select" value={f.status} onChange={set("status")}><option value="active">Activă</option><option value="suspended">Suspendată</option></select></label>
      </div>
      {!id && (
        <>
          <div className="section">Titularul contului (primește invitația pe email)</div>
          <div className="grid2">
            <label className="field">Email titular<input className="input" type="email" value={f.owner_email} onChange={set("owner_email")} placeholder="evaluator@firma.ro" /></label>
            <label className="field">Nume titular<input className="input" value={f.owner_name} onChange={set("owner_name")} /></label>
          </div>
        </>
      )}
      <label className="field">Note interne<textarea className="textarea" rows={2} value={f.notes} onChange={set("notes")} placeholder="ex. tarif convenit, cum a aflat de noi" /></label>
      {msg && <div role={msg.ok ? "status" : "alert"} className={msg.ok ? "okMsg" : "error"}>{msg.t}</div>}
      <div className="actions"><button type="submit" className="btn btnNavy" disabled={busy}>{busy ? "Se salvează…" : id ? "Salvează" : "Creează firma"}</button></div>
    </form>
  );
}

export function ProfileForm({ name: n0, phone: p0, anevar: a0, email }: { name: string; phone: string; anevar: string; email: string }) {
  const [f, setF] = useState({ name: n0, phone: p0, anevar: a0 });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <form className="card" onSubmit={async (e) => {
      e.preventDefault(); setMsg(null);
      const er = await send("/api/account/profile", "PATCH", f);
      setMsg(er ? { ok: false, t: er } : { ok: true, t: "Datele au fost salvate." });
    }}>
      <h2>Datele mele</h2>
      <div className="grid2">
        <label className="field">Nume și prenume<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field">Email<input className="input" value={email} disabled /></label>
        <label className="field">Telefon<input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label className="field">Nr. legitimație ANEVAR<input className="input" value={f.anevar} onChange={(e) => setF({ ...f, anevar: e.target.value })} /></label>
      </div>
      {msg && <div role={msg.ok ? "status" : "alert"} className={msg.ok ? "okMsg" : "error"}>{msg.t}</div>}
      <div className="actions"><button type="submit" className="btn btnNavy">Salvează</button></div>
    </form>
  );
}

export type SessionRow = { id: string; device: string; place: string; created: string; seen: string; current: boolean };

export function SessionsList({ rows }: { rows: SessionRow[] }) {
  const close = async (q: string) => { await send(`/api/account/sessions?${q}`, "DELETE"); location.reload(); };
  return (
    <section className="card">
      <div className="cardHead">
        <h2>Dispozitive conectate</h2>
        {rows.length > 1 && <button type="button" className="btn btnGhost btnSm" onClick={() => { if (confirm("Ieși din cont pe toate celelalte dispozitive?")) close("all=1"); }}>Ieși de pe celelalte</button>}
      </div>
      <ul className="docList">
        {rows.map((s) => (
          <li key={s.id}>
            <span className="who"><b>{s.device}{s.current && <span className="pill pillOk" style={{ marginLeft: 8 }}><i />acesta</span>}</b><small>{s.place} · conectat {s.created} · ultima activitate {s.seen}</small></span>
            {!s.current && <button type="button" className="linkBtn danger" onClick={() => close(`id=${s.id}`)}>Deconectează</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Account actions in the VALUEFY administration (disable, enable, sign out everywhere, VALUEFY admin). */
export function UserActions({ id, status, isSuper, me }: { id: string; status: string; isSuper: boolean; me: boolean }) {
  if (me) return <span className="muted">tu</span>;
  const go = async (action: string, q?: string) => {
    if (q && !confirm(q)) return;
    const e = await send(`/api/admin/users/${id}`, "PATCH", { action });
    if (e) return alert(e);
    location.reload();
  };
  return (
    <span className="actions" style={{ justifyContent: "flex-end", gap: 12 }}>
      {status === "disabled"
        ? <button type="button" className="linkBtn" onClick={() => go("enable")}>Reactivează</button>
        : <button type="button" className="linkBtn danger" onClick={() => go("disable", "Dezactivezi contul? Persoana este deconectată imediat de pe toate dispozitivele.")}>Dezactivează</button>}
      <button type="button" className="linkBtn" onClick={() => go("logout_all", "Deconectezi persoana de pe toate dispozitivele?")}>Deconectează</button>
      <button type="button" className="linkBtn" onClick={() => go(isSuper ? "super_off" : "super_on", isSuper ? "Scoți drepturile de administrator UVALO?" : "Faci persoana administrator UVALO (vede și administrează toate firmele)?")}>{isSuper ? "Scoate admin" : "Fă admin"}</button>
    </span>
  );
}

export function InviteAdmin() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <form className="inlineForm2" onSubmit={async (e) => {
      e.preventDefault();
      const er = await send("/api/admin/superadmins", "POST", { email });
      setMsg(er ? { ok: false, t: er } : { ok: true, t: `Invitația a fost trimisă la ${email}.` });
    }}>
      <label className="field">Invită un administrator UVALO<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coleg@valuefy.ro" required /></label>
      <button type="submit" className="btn btnGhost">Invită</button>
      {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "okMsg" : "error"}>{msg.t}</span>}
    </form>
  );
}
