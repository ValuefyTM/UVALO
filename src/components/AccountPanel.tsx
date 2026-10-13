"use client";

import { useRef, useState } from "react";

const SPEC: Record<string, string> = {
  EI: "Întreprinderi", EPI: "Bunuri imobile", EBM: "Bunuri mobile", EIF: "Instrumente financiare",
  "VE-EI": "Verificare EI", "VE-EPI": "Verificare EPI", "VE-EBM": "Verificare EBM", "VE-EIF": "Verificare EIF",
};

/** Resizes a photo to a 256 px square JPEG (centre crop), so it fits in the account. */
async function square(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height), c = document.createElement("canvas");
  c.width = c.height = 256;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
  return c.toDataURL("image/jpeg", 0.86);
}

/** "Administrare cont": picture and email can be changed; name, card, specializations and county come from the ANEVAR list. */
export function AccountPanel(p: { id: string; name: string; email: string; legit: string | null; county: string | null; specs: string | null; hasAvatar: boolean; initials: string; tablou: string | null }) {
  const [img, setImg] = useState<string | null>(p.hasAvatar ? `/api/avatar/${p.id}?v=${Date.now()}` : null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"" | "code">("");
  const [current, setCurrent] = useState(p.email);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const call = async (url: string, method: string, body: unknown) => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string; email?: string } | undefined;
    return r?.ok ? { ok: true as const, d } : { ok: false as const, error: d?.error || "Nu am putut salva. Încearcă din nou." };
  };
  const setAvatar = async (v: string | null) => {
    setBusy(true); setMsg(null);
    const r = await call("/api/account/avatar", "PATCH", { avatar: v });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: r.error });
    setImg(v); setMsg({ ok: true, t: v ? "Imaginea a fost salvată." : "Imaginea a fost ștearsă." });
    setTimeout(() => location.reload(), 700);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section className="card">
        <h2>Administrare cont</h2>
        <div className="profileHead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img className="avatarBig" src={img} alt="" /> : <span className="avatarBig">{p.initials}</span>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await square(f)); e.target.value = ""; }} />
            <div className="actions">
              <button type="button" className="btn btnNavy btnSm" disabled={busy} onClick={() => file.current?.click()}>{img ? "Schimbă imaginea" : "Adaugă o imagine"}</button>
              {img && <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => setAvatar(null)}>Șterge</button>}
            </div>
            <span className="hint">O fotografie sau sigla firmei. Se decupează pătrat.</span>
          </div>
        </div>
        {msg && <div role={msg.ok ? "status" : "alert"} className={msg.ok ? "okMsg" : "error"}>{msg.t}</div>}
      </section>

      <section className="card">
        <h2>Date din tabloul ANEVAR</h2>
        <dl className="kv">
          <div><dt>Nume și prenume</dt><dd>{p.name || "—"}</dd></div>
          <div><dt>Legitimație ANEVAR</dt><dd className="mono">{p.legit ?? "—"}</dd></div>
          <div><dt>Județ</dt><dd>{p.county ?? "—"}</dd></div>
          <div><dt>Specializări</dt><dd>{p.specs ? <div className="specs" style={{ justifyContent: "flex-end" }}>{p.specs.split(",").map((s) => <span key={s} className="spec" title={SPEC[s]}>{s}</span>)}</div> : "—"}</dd></div>
        </dl>
        <p className="hint">Datele vin din tabloul membrilor titulari ANEVAR{p.tablou ? ` (la ${p.tablou})` : ""} și nu se modifică din cont. Dacă nu sunt corecte, scrie-ne la office@uvalo.ro.</p>
      </section>

      <section className="card">
        <h2>Adresa de email</h2>
        <p className="hint">Cu ea te autentifici și pe ea primești codurile. Acum: <b>{current}</b></p>
        {step === "" ? (
          <form className="inlineForm2" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setMsg(null);
            const r = await call("/api/account/email", "POST", { email });
            setBusy(false);
            if (!r.ok) return setMsg({ ok: false, t: r.error });
            setStep("code");
          }}>
            <label className="field">Adresa nouă<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nume@exemplu.ro" required /></label>
            <button type="submit" className="btn btnGhost" disabled={busy}>Trimite codul</button>
          </form>
        ) : (
          <form className="inlineForm2" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setMsg(null);
            const r = await call("/api/account/email", "PUT", { code });
            setBusy(false);
            if (!r.ok) return setMsg({ ok: false, t: r.error });
            setCurrent(r.d?.email ?? email); setStep(""); setEmail(""); setCode("");
            setMsg({ ok: true, t: "Adresa de email a fost schimbată. De acum te autentifici cu ea." });
          }}>
            <label className="field">Codul trimis la {email}<input className="input codeInput" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))} placeholder="••••••" /></label>
            <button type="submit" className="btn btnNavy" disabled={busy}>Confirmă</button>
            <button type="button" className="linkBtn" onClick={() => setStep("")}>Renunță</button>
          </form>
        )}
      </section>
    </div>
  );
}

export type OfficeData = { name: string; corporate: boolean; corp_no: string; description: string; logo: string | null };

/** A logo picked from disk, shrunk to at most 320 px (PNG keeps the transparency). */
async function shrinkLogo(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/** The office details: firm name, corporate member + authorization number, description, logo (activation and later edits). */
export function OfficeForm({ initial, submitLabel, onCancel, onSaved }: { initial: OfficeData; submitLabel: string; onCancel?: () => void; onSaved: (r: { first: boolean }) => void }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const pick = async (fl: File | undefined) => {
    if (!fl) return;
    if (!/^image\/(png|jpeg|webp)$/.test(fl.type)) return setErr("Alege o imagine PNG, JPG sau WebP.");
    try { setF({ ...f, logo: await shrinkLogo(fl) }); setErr(""); } catch { setErr("Nu am putut citi imaginea."); }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr("Scrie denumirea firmei.");
    if (f.corporate && !f.corp_no.trim()) return setErr("Scrie numărul autorizației de membru corporativ.");
    setBusy(true); setErr("");
    const logo = f.logo === initial.logo ? undefined : f.logo ?? null; // unchanged logos are not sent again
    const r = await fetch("/api/account/office", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, logo }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string; first?: boolean } | undefined;
    setBusy(false);
    if (!r?.ok) return setErr(d?.error || "Nu am putut salva. Încearcă din nou.");
    onSaved({ first: !!d?.first });
  };
  return (
    <form className="officeForm" onSubmit={save} noValidate>
      <label className="field">Denumirea firmei<input className="input" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ex. Evaluări Imobiliare SRL" /></label>
      <label className="check"><input type="checkbox" checked={f.corporate} onChange={(e) => setF({ ...f, corporate: e.target.checked })} />Firma este membru corporativ ANEVAR</label>
      {f.corporate && <label className="field">Nr. autorizației de membru corporativ<input className="input" value={f.corp_no} maxLength={40} onChange={(e) => setF({ ...f, corp_no: e.target.value })} placeholder="ex. 0123" /></label>}
      <label className="field"><span>Descriere <small>(opțional)</small></span><textarea className="input" rows={3} maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="ex. Evaluări pentru bănci și persoane fizice în Timiș și Arad." /></label>
      <div className="field"><span>Logo <small>(opțional)</small></span>
        <div className="officeLogoRow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {f.logo ? <img className="officeLogo" src={f.logo} alt="Logo-ul firmei" /> : <span className="officeLogo empty" aria-hidden="true">LOGO</span>}
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" className="btn btnGhost btnSm" onClick={() => file.current?.click()}>{f.logo ? "Schimbă logo-ul" : "Încarcă logo"}</button>
          {f.logo && <button type="button" className="linkBtn danger" onClick={() => setF({ ...f, logo: null })}>Scoate</button>}
        </div>
      </div>
      {err && <div role="alert" className="error">{err}</div>}
      <div className="actions" style={{ gap: 10 }}>
        <button type="submit" className="btn btnGold" disabled={busy}>{busy ? "Se salvează…" : submitLabel}</button>
        {onCancel && <button type="button" className="btn btnGhost" onClick={onCancel}>Renunță</button>}
      </div>
    </form>
  );
}

/**
 * "Birou de evaluare" in the account. Not turned on by the administration: "În curând · în testare" + "Anunță-mă".
 * Turned on: activation with the office details, then "Firma mea" (the office's people, who may be non-valuers).
 */
export function OfficeCard(p: { allowed: boolean; active: boolean; asked: boolean; member: string | null; initial: OfficeData }) {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(p.asked);
  const [busy, setBusy] = useState(false);
  if (!p.allowed) return (
    <section className="card officeSoon">
      <div className="cardHead"><h2>Birou de evaluare</h2><span className="pill pillWarn">În curând · în testare</span></div>
      <p className="hint" style={{ margin: 0 }}>Vei putea lucra ca birou: denumirea și logo-ul firmei, colegii din birou (evaluatori și colaboratori fără legitimație) și activitatea echipei, într-un singur loc. Funcția este acum în testare cu câteva birouri.</p>
      <div className="actions" style={{ gap: 10, alignItems: "center" }}>
        {asked ? <span className="okMsg">✓ Te anunțăm când se lansează.</span> : (
          <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={async () => {
            setBusy(true);
            const r = await fetch("/api/interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "birou" }) }).catch(() => null);
            setBusy(false); if (r?.ok) setAsked(true);
          }}>Anunță-mă când se lansează</button>
        )}
      </div>
    </section>
  );
  if (p.active) return (
    <section className="card">
      <div className="cardHead"><h2>Birou de evaluare</h2><span className="pill pillOk"><i />Activ</span></div>
      <div className="officeSum">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.initial.logo ? <img className="officeLogo" src={p.initial.logo} alt="" /> : <span className="officeLogo empty" aria-hidden="true">{p.initial.name.slice(0, 2).toUpperCase()}</span>}
        <span><b>{p.initial.name}</b><small>{p.initial.corporate ? `Membru corporativ ANEVAR · aut. ${p.initial.corp_no}` : "Birou de evaluare"}</small></span>
        <a className="btn btnNavy btnSm" href="/firma" style={{ marginLeft: "auto" }}>Administrează biroul →</a>
      </div>
    </section>
  );
  return (
    <section className="card">
      <div className="cardHead"><h2>Birou de evaluare</h2><span className="pill pillInfo"><i />În testare</span></div>
      {p.member ? (
        <p className="hint" style={{ margin: 0 }}>Faci parte din echipa {p.member}. Biroul este administrat de titularul contului firmei.</p>
      ) : !open ? (
        <>
          <p className="hint" style={{ margin: 0 }}>Lucrezi cu o echipă? Activează funcția de birou: completezi detaliile firmei, apoi adaugi colegii (evaluatori sau colaboratori fără legitimație) din pagina de administrare a biroului.</p>
          <div><button type="button" className="btn btnGold" onClick={() => setOpen(true)}>Activează funcția de birou</button></div>
        </>
      ) : (
        <OfficeForm initial={p.initial} submitLabel="Activează și deschide biroul" onCancel={() => setOpen(false)} onSaved={() => { location.href = "/firma?nou=1"; }} />
      )}
    </section>
  );
}

/** "Închide contul": the person closes their own account (nothing is deleted), after typing its email; the reason is optional. */
export function CloseAccount({ email, reasons }: { email: string; reasons: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = val.trim().toLowerCase() === email.toLowerCase();
  const go = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: val, reason, note }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!r?.ok) { setBusy(false); return setErr(d?.error || "Nu am putut închide contul. Încearcă din nou."); }
    location.href = "/login?inchis=1";
  };
  return (
    <section className="card">
      <div className="cardHead"><h2>Închide contul</h2></div>
      {!open ? (
        <div className="actions" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <p className="hint" style={{ margin: 0, flex: "1 1 320px" }}>Nu mai vrei să folosești UVALO? Îți poți închide contul. Dacă revii, îl redeschizi solicitând din nou cont.</p>
          <button type="button" className="btn btnDanger btnSm" onClick={() => setOpen(true)}>Închide contul…</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (ok && !busy) go(); }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Vei fi deconectat de pe toate dispozitivele și nu te vei mai putea autentifica. În Colaborări nu mai primești notificări, iar anunțurile tale active se arhivează.
            Dacă revii, soliciți din nou cont cu aceeași adresă de email.
          </p>
          <label className="field">De ce pleci? (opțional)
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Alege un motiv</option>
              {reasons.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="field">Ce ar trebui să îmbunătățim? (opțional)<textarea className="input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="field">Scrie {email} ca să confirmi<input className="input" type="email" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} /></label>
          {err && <div role="alert" className="error">{err}</div>}
          <div className="actions" style={{ gap: 10, marginTop: 12 }}>
            <button type="submit" className="btn btnDanger" disabled={!ok || busy}>{busy ? "Se închide…" : "Închide contul"}</button>
            <button type="button" className="btn btnGhost" onClick={() => { setOpen(false); setVal(""); setErr(""); }}>Renunță</button>
          </div>
        </form>
      )}
    </section>
  );
}

/** "Firma mea": the office card on top (logo, name, corporate member) with "Editează detaliile". */
export function OfficeHeader({ initial, canEdit, welcome }: { initial: OfficeData; canEdit: boolean; welcome: boolean }) {
  const [edit, setEdit] = useState(false);
  return (
    <section className="card">
      {welcome && <div className="okMsg" role="status">Biroul este activ. Adaugă colegii mai jos: evaluatori sau colaboratori fără legitimație ANEVAR (asistenți, inspectori). Fiecare primește invitația pe email.</div>}
      {edit ? (
        <OfficeForm initial={initial} submitLabel="Salvează detaliile" onCancel={() => setEdit(false)} onSaved={() => location.reload()} />
      ) : (
        <div className="officeSum">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {initial.logo ? <img className="officeLogo big" src={initial.logo} alt="Logo-ul firmei" /> : <span className="officeLogo big empty" aria-hidden="true">{initial.name.slice(0, 2).toUpperCase()}</span>}
          <span className="officeSumText">
            <b>{initial.name}</b>
            <small>{initial.corporate ? `Membru corporativ ANEVAR · autorizația nr. ${initial.corp_no}` : "Birou de evaluare"}</small>
            {initial.description && <span className="officeDesc">{initial.description}</span>}
          </span>
          {canEdit && <button type="button" className="btn btnGhost btnSm" style={{ marginLeft: "auto" }} onClick={() => setEdit(true)}>Editează detaliile</button>}
        </div>
      )}
    </section>
  );
}
