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
        <p className="hint">Datele vin din tabloul membrilor titulari ANEVAR{p.tablou ? ` (la ${p.tablou})` : ""} și nu se modifică din cont. Dacă nu sunt corecte, scrie-ne la office@valuefy.ro.</p>
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

/** "Lucrez ca birou de evaluare": turns on "Firma mea" (colleagues, seats, team activity). */
export function OfficeToggle(p: { on: boolean; can: boolean; org: string | null }) {
  const [on, setOn] = useState(p.on);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const flip = async (v: boolean) => {
    setBusy(true); setErr("");
    const r = await fetch("/api/account/office", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: v }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr("Nu am putut salva. Încearcă din nou.");
    setOn(v); setTimeout(() => location.reload(), 500);
  };
  return (
    <section className="card">
      <div className="cardHead"><h2>Birou de evaluare</h2>{on && p.can && <a className="btn btnGhost btnSm" href="/firma">Firma mea →</a>}</div>
      {p.can ? (
        <>
          <label className="switchRow">
            <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={(e) => flip(e.target.checked)} />
            <span className="switch" aria-hidden="true" />
            <span><b>Lucrez ca birou de evaluare</b><small>Activează „Firma mea”{p.org ? ` (${p.org})` : ""}: colegii din birou, locurile din abonament și activitatea echipei.</small></span>
          </label>
          {err && <div role="alert" className="error">{err}</div>}
        </>
      ) : (
        <p className="hint">{p.org ? `Faci parte din echipa ${p.org}. Colegii și abonamentul sunt administrate de titularul contului firmei.` : "Contul tău nu face parte încă dintr-o firmă."}</p>
      )}
    </section>
  );
}
