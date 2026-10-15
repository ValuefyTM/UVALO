"use client";

import { useEffect, useState } from "react";

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
          <small>{k === "angajat" ? "lucrează în firmă; inspecțiile primite apar pe telefon în Acasă" : "extern; inspecțiile primite apar pe telefon în Colaborări"}</small>
        </label>
      ))}
    </div>
  );
}

export type OfficeLinkRow = { id: string; kind: Kind; status: string; since: string; user_id: string; name: string | null; email: string; anevar_no: string | null; county: string | null };

/**
 * "Firma mea" → Asocieri: valuers with their own account linked to the office (no seat): angajați and colaboratori,
 * the requests received, the invitations sent, and the form that invites by email or ANEVAR card.
 */
export function OfficeLinks({ rows }: { rows: OfficeLinkRow[] }) {
  const [f, setF] = useState<{ who: string; kind: Kind }>({ who: "", kind: "angajat" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const run = async (key: string, body: Record<string, unknown>, ok?: string, ask?: string) => {
    if (ask && !confirm(ask)) return;
    setBusy(key); setMsg(null);
    const e = await act(body);
    setBusy("");
    if (e) return setMsg({ ok: false, t: e });
    if (ok) { setMsg({ ok: true, t: ok }); setTimeout(() => location.reload(), 900); } else location.reload();
  };
  const req = rows.filter((r) => r.status === "requested"), inv = rows.filter((r) => r.status === "invited");
  const act1 = rows.filter((r) => r.status === "active");
  const nm = (r: OfficeLinkRow) => r.name || r.email;
  const sub = (r: OfficeLinkRow) => [r.email, r.anevar_no ? `leg. ANEVAR ${r.anevar_no}` : "", r.county ?? ""].filter(Boolean).join(" · ");
  const group = (k: Kind) => act1.filter((r) => r.kind === k);

  return (
    <section className="card" id="asocieri">
      <div className="cardHead"><h2>Evaluatori asociați</h2><span className="pill pillInfo"><i />{act1.length} {act1.length === 1 ? "asociat" : "asociați"}</span></div>
      <p className="hint" style={{ margin: 0 }}>Evaluatori care au contul lor UVALO și lucrează cu biroul: angajați sau colaboratori. <b>Nu ocupă locuri</b> în birou, iar
        contul lor rămâne al lor. Colegii fără legitimație ANEVAR îi adaugi ca membri (rol operațional).</p>
      {msg && <div role={msg.ok ? "status" : "alert"} className={msg.ok ? "okMsg" : "error"}>{msg.t}</div>}

      {req.length > 0 && <div className="lkBlock">
        <h3>Cereri de asociere <span className="pill pillWarn"><i />{req.length}</span></h3>
        {req.map((r) => (
          <div key={r.id} className="leaveRow">
            <span><b>{nm(r)} <em className="lkTag">{KIND[r.kind]}</em></b><small>{sub(r)} · cerută {r.since}</small></span>
            <span className="actions" style={{ gap: 10 }}>
              <button type="button" className="linkBtn" disabled={!!busy} onClick={() => run(r.id, { action: "reject", id: r.id })}>Respinge</button>
              <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => run(r.id, { action: "approve", id: r.id })}>{busy === r.id ? "…" : "Aprobă"}</button>
            </span>
          </div>
        ))}
      </div>}

      {(["angajat", "colaborator"] as Kind[]).map((k) => (
        <div key={k} className="lkBlock">
          <h3>{k === "angajat" ? "Angajați" : "Colaboratori"} <span className="muted">{group(k).length}</span></h3>
          {!group(k).length && <p className="hint" style={{ margin: "4px 0 0" }}>{k === "angajat" ? "Niciun angajat asociat." : "Niciun colaborator asociat."}</p>}
          {group(k).map((r) => (
            <div key={r.id} className="leaveRow">
              <span><b>{nm(r)}</b><small>{sub(r)} · asociat din {r.since}</small></span>
              <span className="actions" style={{ gap: 10 }}>
                <button type="button" className="linkBtn" disabled={!!busy} onClick={() => run(r.id, { action: "kind", id: r.id, kind: k === "angajat" ? "colaborator" : "angajat" })}>
                  Treci la {k === "angajat" ? "colaborator" : "angajat"}
                </button>
                <button type="button" className="linkBtn danger" disabled={!!busy}
                  onClick={() => run(r.id, { action: "end", id: r.id }, undefined, `Închei asocierea cu ${nm(r)}? Contul lui rămâne neschimbat; inspecțiile făcute pentru birou rămân ale biroului.`)}>Încheie asocierea</button>
              </span>
            </div>
          ))}
        </div>
      ))}

      {inv.length > 0 && <div className="lkBlock">
        <h3>Invitații trimise <span className="muted">{inv.length}</span></h3>
        {inv.map((r) => (
          <div key={r.id} className="leaveRow">
            <span><b>{nm(r)} <em className="lkTag">{KIND[r.kind]}</em></b><small>{sub(r)} · trimisă {r.since} · așteaptă răspunsul</small></span>
            <button type="button" className="linkBtn danger" disabled={!!busy} onClick={() => run(r.id, { action: "cancel", id: r.id })}>Anulează</button>
          </div>
        ))}
      </div>}

      <form className="lkForm" onSubmit={(e) => { e.preventDefault(); void run("inv", { action: "invite", who: f.who, kind: f.kind }, "Invitația a fost trimisă. Evaluatorul o acceptă din contul lui."); }}>
        <h3>Asociază un evaluator</h3>
        <label className="field"><span>Emailul contului UVALO sau legitimația ANEVAR</span>
          <input className="input" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} placeholder="ex. ana@exemplu.ro sau 15902" required />
        </label>
        <KindPick value={f.kind} onChange={(kind) => setF({ ...f, kind })} name="lkKindInv" />
        <div className="actions"><button type="submit" className="btn btnNavy" disabled={!!busy || !f.who.trim()}>{busy === "inv" ? "Se trimite…" : "Trimite invitația"}</button></div>
      </form>
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
