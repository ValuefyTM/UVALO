"use client";

import { useEffect, useRef, useState } from "react";
import { UserAv } from "./UserAv";

type Kind = "angajat" | "colaborator";
const KIND: Record<Kind, string> = { angajat: "Angajat", colaborator: "Colaborator" };

async function act(body: Record<string, unknown>) {
  const r = await fetch("/api/office/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
  return r?.ok ? null : d?.error || "Nu am putut salva. Încearcă din nou.";
}

function KindPick({ value, onChange, name }: { value: Kind; onChange: (k: Kind) => void; name: string }) {
  return (
    <div className="lkKinds" role="radiogroup" aria-label="Tipul asocierii">
      {(["angajat", "colaborator"] as Kind[]).map((k) => (
        <label key={k} className={value === k ? "on" : undefined}>
          <input type="radio" name={name} checked={value === k} onChange={() => onChange(k)} />
          <b>{KIND[k]}</b>
          <small>{k === "angajat" ? "lucrez pentru firmă și pe cont propriu sau cu alte firme; primesc inspecțiile firmei direct, fără acceptare" : "colaborez ocazional; primesc solicitări de inspecție pe care le accept sau le refuz"}</small>
        </label>
      ))}
    </div>
  );
}

export type OfficeLinkRow = { id: string; kind: Kind; status: string; since: string; user_id: string; name: string | null; email: string; anevar_no: string | null; county: string | null; has_av?: boolean; admin?: boolean };
export type PersonRow = { user_id: string; email: string; name: string; status: string; role: string; anevar: boolean; last_seen: string; me: boolean; has_av?: boolean };
export type MemberInvite = { id: string; email: string; role: string; created: string; expires: string; by: string | null };

type InvType = "member" | "ops" | "angajat" | "colaborator";
const INV: { k: InvType; t: string; d: string; seat: boolean }[] = [
  { k: "member", t: "Evaluator în birou", d: "Evaluator care lucrează doar prin birou și nu face alte inspecții. Folosește abonamentul biroului și primește cont nou pe email.", seat: true },
  { k: "ops", t: "Operațional", d: "Fără legitimație ANEVAR (asistent, secretariat): vede și introduce inspecțiile firmei, nu face inspecții.", seat: true },
  { k: "angajat", t: "Angajat asociat", d: "Evaluator cu cont UVALO propriu, care face evaluări și pe cont propriu sau cu alte firme. Primește inspecțiile biroului automat, fără să le accepte.", seat: false },
  { k: "colaborator", t: "Colaborator asociat", d: "Evaluator extern, cu cont UVALO propriu. Primește o solicitare pentru fiecare inspecție și trebuie să o accepte înainte să i se aloce.", seat: false },
];
const ROLE: Record<string, string> = { owner: "Titular cont", admin: "Administrator", member: "Membru" };

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
  return r?.ok ? null : d?.error || "Nu am putut salva. Încearcă din nou.";
}

/** „Invită”: first the kind of person, then the matching short form (members by email, associates by email or ANEVAR card). */
function InviteDialog({ onClose, full }: { onClose: () => void; full: boolean }) {
  const [type, setType] = useState<InvType | null>(null);
  const [f, setF] = useState({ email: "", name: "", admin: false, who: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { dlg.current?.showModal?.(); }, []);
  const cur = INV.find((x) => x.k === type);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!type) return;
    setBusy(true); setMsg(null);
    const er = type === "member" || type === "ops"
      ? await call("/api/org/members", "POST", { email: f.email, name: f.name, role: f.admin && type === "member" ? "admin" : "member" })
      : await act({ action: "invite", who: f.who, kind: type });
    setBusy(false);
    if (er) return setMsg({ ok: false, t: er });
    setMsg({ ok: true, t: type === "member" || type === "ops" ? `Invitația a fost trimisă la ${f.email}.` : "Invitația a fost trimisă. Evaluatorul o acceptă din contul lui." });
    setTimeout(() => location.reload(), 1000);
  };
  return (
    <dialog ref={dlg} className="modal opDlg" aria-labelledby="opInvT" onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <div className="modalBox">
        <button type="button" className="modalX" aria-label="Închide" onClick={() => dlg.current?.close()}>×</button>
        <h2 id="opInvT">{cur ? cur.t : "Pe cine inviți?"}</h2>
        {!cur ? (
          <div className="opTypes">
            {INV.map((x) => {
              const off = x.seat && full;
              return (
                <button key={x.k} type="button" disabled={off} onClick={() => setType(x.k)}>
                  <b>{x.t} <em className={x.seat ? "opSeat" : "opSeat free"}>{x.seat ? "ocupă un loc" : "fără loc"}</em></b>
                  <small>{off ? "Toate locurile sunt ocupate. Scoate pe cineva sau scrie-ne pentru locuri în plus." : x.d}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <form className="modalForm" onSubmit={submit}>
            <p className="hint" style={{ margin: 0 }}>{cur.d}</p>
            {type === "member" || type === "ops" ? <>
              <label className="field">Email<input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nume@firma.ro" required autoFocus /></label>
              <label className="field">Nume <small>(opțional)</small><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              {type === "member" && (
                <label className="check"><input type="checkbox" checked={f.admin} onChange={(e) => setF({ ...f, admin: e.target.checked })} /> Administrator al biroului (invită și gestionează oamenii)</label>
              )}
            </> : (
              <label className="field">Emailul contului UVALO sau legitimația ANEVAR
                <input className="input" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} placeholder="ex. ana@exemplu.ro sau 15902" required autoFocus />
              </label>
            )}
            {msg && <div role={msg.ok ? "status" : "alert"} className={msg.ok ? "okMsg" : "error"}>{msg.t}</div>}
            <div className="modalActions">
              <button type="button" className="btn btnGhost" onClick={() => { setType(null); setMsg(null); }}>← Înapoi</button>
              <button type="submit" className="btn btnNavy" disabled={busy}>{busy ? "Se trimite…" : "Trimite invitația"}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

/**
 * "Firma mea" → Oamenii biroului, într-un singur panou, grupați: administratori, evaluatori și operaționali (membri, ocupă locuri),
 * angajați și colaboratori asociați (cont propriu, fără loc), cererile de asociere și invitațiile. „Invită” deschide fereastra cu tipul.
 */
export function OfficePeople({ people, invites, links, seats, used, canOwner, staffCreate }: {
  people: PersonRow[]; invites: MemberInvite[]; links: OfficeLinkRow[]; seats: number; used: number; canOwner: boolean; staffCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const run = async (key: string, fn: () => Promise<string | null>, ask?: string) => {
    if (ask && !confirm(ask)) return;
    setBusy(key); setErr("");
    const e = await fn();
    setBusy("");
    if (e) return setErr(e);
    location.reload();
  };
  const req = links.filter((r) => r.status === "requested"), linv = links.filter((r) => r.status === "invited");
  const assoc = (k: Kind) => links.filter((r) => r.status === "active" && r.kind === k);
  const nm = (r: { name: string | null; email: string }) => r.name || r.email;
  const lsub = (r: OfficeLinkRow) => [r.email, r.anevar_no ? `leg. ANEVAR ${r.anevar_no}` : "", r.county ?? ""].filter(Boolean).join(" · ");

  const member = (m: PersonRow) => (
    <div key={m.user_id} className="opRow">
      <UserAv id={m.user_id} name={m.name || m.email} has={m.has_av} size={34} /><span className="opWho"><b>{m.name || m.email}{m.me && <span className="muted"> (tu)</span>}</b>
        <small>{m.email} · activ {m.last_seen}{m.status !== "active" ? (m.status === "disabled" ? " · dezactivat" : m.status === "closed" ? " · a renunțat" : " · invitat") : ""}</small></span>
      <span className="opAct">
        {!m.anevar && (
          <button type="button" className="linkBtn" disabled={!!busy} title="Operaționalul a devenit evaluator: legitimația se verifică în Tabloul ANEVAR și datele se preiau de acolo"
            onClick={() => { const v = prompt(`Legitimația ANEVAR a lui ${m.name || m.email}:`); if (v?.trim()) void run(m.user_id, () => call("/api/org/legit", "POST", { user: m.user_id, legit: v.trim() })); }}>
            Adaugă legitimația</button>
        )}
        {m.me || (m.role === "owner" && !canOwner) ? <span className="muted opRole">{ROLE[m.role]}</span> : (
          <select className="select" value={m.role} disabled={!!busy} aria-label={`Rolul lui ${m.name || m.email}`}
            onChange={(e) => run(m.user_id, () => call("/api/org/members", "PATCH", { user: m.user_id, role: e.target.value }))}>
            {Object.entries(ROLE).filter(([k]) => k !== "owner" || canOwner).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        {!m.me && (m.role !== "owner" || canOwner) && (
          <button type="button" className="linkBtn danger" disabled={!!busy}
            onClick={() => run(m.user_id, () => call(`/api/org/members?user=${m.user_id}`, "DELETE"), `Scoți pe ${m.name || m.email} din birou? Nu mai are acces la instrumente.`)}>Scoate</button>
        )}
      </span>
    </div>
  );
  // someone invited who has not joined yet shows only under "Invitații în așteptare"
  const invited = new Set(invites.map((i) => i.email.toLowerCase()));
  const ppl = people.filter((m) => !(m.status === "invited" && invited.has(m.email.toLowerCase())));
  const groups: { k: string; t: string; note: string; rows: React.ReactNode[] }[] = [
    { k: "admin", t: "Administratori", note: "ocupă locuri · gestionează biroul", rows: ppl.filter((m) => m.role !== "member").map(member) },
    { k: "eval", t: "Evaluatori", note: "membri · ocupă locuri · lucrează doar prin birou", rows: ppl.filter((m) => m.role === "member" && m.anevar).map(member) },
    { k: "ops", t: "Operaționali", note: "fără legitimație · ocupă locuri · văd și introduc inspecțiile firmei", rows: ppl.filter((m) => m.role === "member" && !m.anevar).map(member) },
    ...(["angajat", "colaborator"] as Kind[]).map((k) => ({
      k, t: k === "angajat" ? "Angajați asociați" : "Colaboratori asociați", note: k === "angajat" ? "cont propriu · fără loc · primesc inspecțiile direct · văd doar inspecțiile lor; bifa „Administrator” = le văd pe toate ale biroului" : "cont propriu · fără loc · acceptă fiecare solicitare",
      rows: assoc(k).map((r) => (
        <div key={r.id} className="opRow">
          <UserAv id={r.user_id} name={nm(r)} has={r.has_av} size={34} /><span className="opWho"><b>{nm(r)}{r.admin && <em className="lkTag">Administrator</em>}</b><small>{lsub(r)} · asociat din {r.since}</small></span>
          <span className="opAct">
            {k === "angajat" && (
              <label className="opAdm" title="Vede și gestionează toate inspecțiile biroului. Fără bifă vede doar inspecțiile primite.">
                <input type="checkbox" checked={!!r.admin} disabled={!!busy} onChange={(e) => run(r.id, () => act({ action: "admin", id: r.id, on: e.target.checked }))} /> Administrator
              </label>
            )}
            <button type="button" className="linkBtn" disabled={!!busy} onClick={() => run(r.id, () => act({ action: "kind", id: r.id, kind: k === "angajat" ? "colaborator" : "angajat" }))}>
              Treci la {k === "angajat" ? "colaborator" : "angajat"}</button>
            <button type="button" className="linkBtn danger" disabled={!!busy}
              onClick={() => run(r.id, () => act({ action: "end", id: r.id }), `Închei asocierea cu ${nm(r)}? Contul lui rămâne neschimbat; inspecțiile făcute pentru birou rămân ale biroului.`)}>Încheie asocierea</button>
          </span>
        </div>
      )),
    })),
  ];
  const pending = invites.length + linv.length;

  return (
    <section className="card" id="asocieri">
      <div className="cardHead">
        <h2>Utilizatori <span className="muted">· {used} din {seats} locuri ocupate · {assoc("angajat").length + assoc("colaborator").length} asociați</span></h2>
        <button type="button" className="btn btnNavy btnSm" onClick={() => setOpen(true)}>+ Invită</button>
      </div>
      {err && <div role="alert" className="error">{err}</div>}

      {req.length > 0 && <div className="opGroup op-req">
        <h3><i className="opDot" aria-hidden="true" />Cereri de asociere <span className="pill pillWarn"><i />{req.length}</span></h3>
        {req.map((r) => (
          <div key={r.id} className="opRow">
            <UserAv id={r.user_id} name={nm(r)} has={r.has_av} size={34} /><span className="opWho"><b>{nm(r)} <em className="lkTag">{KIND[r.kind]}</em></b><small>{lsub(r)} · cerută {r.since}</small></span>
            <span className="opAct">
              <button type="button" className="linkBtn" disabled={!!busy} onClick={() => run(r.id, () => act({ action: "reject", id: r.id }))}>Respinge</button>
              <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => run(r.id, () => act({ action: "approve", id: r.id }))}>{busy === r.id ? "…" : "Aprobă"}</button>
            </span>
          </div>
        ))}
      </div>}

      {groups.filter((g) => g.rows.length).map((g) => (
        <div key={g.t} className={`opGroup op-${g.k}`}>
          <h3><i className="opDot" aria-hidden="true" />{g.t} <span className="opN">{g.rows.length}</span><small>{g.note}</small></h3>
          {g.rows}
          {g.k === "angajat" && (
            <label className="opOpt"><input type="checkbox" checked={staffCreate} disabled={!!busy}
              onChange={(e) => run("staff", () => act({ action: "staff_create", on: e.target.checked }))} />
              <span><b>Angajații pot crea inspecții pentru birou de pe telefon</b><small>La „Inspecție nouă” aleg „Pentru: Contul meu / {"biroul"}”. Oprit: biroul le atribuie.</small></span></label>
          )}
        </div>
      ))}

      {pending > 0 && <div className="opGroup op-inv">
        <h3><i className="opDot" aria-hidden="true" />Invitații în așteptare <span className="opN">{pending}</span><small>nu au acceptat încă</small></h3>
        {invites.map((i) => (
          <div key={i.id} className="opRow">
            <UserAv name={i.email} size={34} /><span className="opWho"><b>{i.email} <em className="lkTag">{ROLE[i.role] ?? "Membru"}</em></b><small>trimisă {i.created}{i.by ? ` de ${i.by}` : ""} · expiră {i.expires}</small></span>
            <span className="opAct">
              <button type="button" className="linkBtn" disabled={!!busy} onClick={() => run(i.id, () => call("/api/org/members", "POST", { resend: i.id }))}>Retrimite</button>
              <button type="button" className="linkBtn danger" disabled={!!busy} onClick={() => run(i.id, () => call("/api/org/members", "POST", { cancel: i.id }))}>Anulează</button>
            </span>
          </div>
        ))}
        {linv.map((r) => (
          <div key={r.id} className="opRow">
            <UserAv id={r.user_id} name={nm(r)} has={r.has_av} size={34} /><span className="opWho"><b>{nm(r)} <em className="lkTag">{KIND[r.kind]} asociat</em></b><small>{lsub(r)} · trimisă {r.since} · o acceptă din contul lui</small></span>
            <span className="opAct"><button type="button" className="linkBtn danger" disabled={!!busy} onClick={() => run(r.id, () => act({ action: "cancel", id: r.id }))}>Anulează</button></span>
          </div>
        ))}
      </div>}
      {open && <InviteDialog onClose={() => setOpen(false)} full={used >= seats} />}
    </section>
  );
}

export type MyLinkRow = { id: string; kind: Kind; status: string; since: string; ended: string | null; org_id: string; org_name: string; corp_no: string | null; has_logo: boolean };
type Office = { id: string; name: string; corp_no: string | null; has_logo: number };

const Logo = ({ id, has, name }: { id: string; has: boolean; name: string }) =>
  has ? <img className="lkLogo" src={`/api/org/logo/${id}`} alt="" /> : <span className="lkLogo" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>;

/** "Contul meu" → Asocieri cu birouri: invitations received, active links, requests sent, and asking an office to link. */
export function MyLinks({ rows, canRequest }: { rows: MyLinkRow[]; canRequest: boolean }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Office[] | null>(null);
  const [pick, setPick] = useState<Office | null>(null);
  const [kind, setKind] = useState<Kind>("colaborator");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/office/links?q=${encodeURIComponent(q.trim())}`).catch(() => null);
      const d = (await r?.json().catch(() => null)) as { offices?: Office[] } | null;
      setFound(d?.offices ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  if (!rows.length && !canRequest) return null;
  const run = async (key: string, body: Record<string, unknown>, ask?: string) => {
    if (ask && !confirm(ask)) return;
    setBusy(key); setErr("");
    const e = await act(body);
    setBusy("");
    if (e) return setErr(e);
    location.reload();
  };
  const by = (s: string) => rows.filter((r) => r.status === s);
  const line = (r: MyLinkRow, extra: string) => (
    <span className="lkOrg"><Logo id={r.org_id} has={r.has_logo} name={r.org_name} />
      <span><b>{r.org_name} <em className="lkTag">{KIND[r.kind]}</em></b><small>{r.corp_no ? `aut. ANEVAR ${r.corp_no} · ` : ""}{extra}</small></span></span>
  );

  return (
    <section className="card" id="asocieri">
      <div className="cardHead"><h2>Asocieri cu birouri de evaluare</h2>{by("invited").length > 0 && <span className="pill pillWarn"><i />{by("invited").length} {by("invited").length === 1 ? "invitație" : "invitații"}</span>}</div>
      <p className="hint" style={{ margin: 0 }}>Lucrezi și cu o firmă de evaluare, ca angajat sau colaborator? Asocierea îi permite biroului să-ți atribuie inspecții.
        <b> Contul tău rămâne al tău</b>, cu inspecțiile tale. O poți încheia oricând.</p>
      {err && <div role="alert" className="error">{err}</div>}

      {by("invited").map((r) => (
        <div key={r.id} className="leaveRow lkInvite">
          {line(r, `te-a invitat ${r.since}`)}
          <span className="actions" style={{ gap: 10 }}>
            <button type="button" className="linkBtn" disabled={!!busy} onClick={() => run(r.id, { action: "decline", id: r.id })}>Refuză</button>
            <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => run(r.id, { action: "accept", id: r.id })}>{busy === r.id ? "…" : "Acceptă"}</button>
          </span>
        </div>
      ))}
      {by("active").map((r) => (
        <div key={r.id} className="leaveRow">
          {line(r, `asociat din ${r.since}`)}
          <button type="button" className="linkBtn danger" disabled={!!busy}
            onClick={() => run(r.id, { action: "end", id: r.id }, `Închei asocierea cu ${r.org_name}? Biroul nu-ți mai poate atribui inspecții.`)}>Încheie asocierea</button>
        </div>
      ))}
      {by("requested").map((r) => (
        <div key={r.id} className="leaveRow">
          {line(r, `cerere trimisă ${r.since} · așteaptă aprobarea biroului`)}
          <button type="button" className="linkBtn danger" disabled={!!busy} onClick={() => run(r.id, { action: "cancel", id: r.id })}>Retrage cererea</button>
        </div>
      ))}
      {by("ended").length > 0 && (
        <details className="lkEnded"><summary>Asocieri încheiate ({by("ended").length})</summary>
          {by("ended").map((r) => <div key={r.id} className="leaveRow">{line(r, `${r.since} – ${r.ended ?? ""}`)}</div>)}
        </details>
      )}

      {canRequest && (
        <div className="lkForm">
          <h3>Asociază-te cu o firmă</h3>
          {sent ? <div className="okMsg" role="status">Cererea a fost trimisă. Administratorii biroului o aprobă din „Firma mea”.</div> : <>
            <label className="field"><span>Caută biroul de evaluare după nume</span>
              <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} placeholder="ex. Evaluări Timiș" />
            </label>
            {found && !pick && (
              <div className="lkFound">
                {!found.length && <p className="hint" style={{ margin: 0 }}>Niciun birou cu acest nume în UVALO.</p>}
                {found.map((o) => (
                  <button key={o.id} type="button" onClick={() => setPick(o)}>
                    <Logo id={o.id} has={!!o.has_logo} name={o.name} /><span><b>{o.name}</b>{o.corp_no && <small>aut. ANEVAR {o.corp_no}</small>}</span>
                  </button>
                ))}
              </div>
            )}
            {pick && <>
              <div className="lkPicked"><Logo id={pick.id} has={!!pick.has_logo} name={pick.name} /><b>{pick.name}</b><button type="button" className="linkBtn" onClick={() => setPick(null)}>Schimbă</button></div>
              <KindPick value={kind} onChange={setKind} name="lkKindReq" />
              <div className="actions">
                <button type="button" className="btn btnNavy" disabled={!!busy} onClick={async () => {
                  setBusy("req"); setErr(""); const e = await act({ action: "request", org_id: pick.id, kind }); setBusy("");
                  if (e) setErr(e); else { setSent(true); setTimeout(() => location.reload(), 1500); }
                }}>{busy === "req" ? "Se trimite…" : "Trimite cererea"}</button>
              </div>
            </>}
          </>}
        </div>
      )}
    </section>
  );
}
