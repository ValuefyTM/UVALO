"use client";

import { useEffect, useState } from "react";

/**
 * Inspecții without a connected phone: the module needs the UVALO app (inspections are done on the phone). The app shows a
 * connect screen that asks for the 6-digit code below. In test mode the super-admin can go on without a phone.
 */
export function InspActivate({ testMode }: { testMode: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!left) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  async function call(action: string) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) throw new Error(j.error || "Nu a mers.");
      if (action === "pair_code") { setCode(j.code); setLeft(600); } else location.reload();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="inAct">
      <div className="inActHead">
        <span className="eyebrow">Inspecții · activare</span>
        <h2>Instalează aplicația UVALO pe telefon ca să folosești Inspecțiile</h2>
        <p>Inspecțiile se fac pe telefon: fișa, fotografiile cu ora și locul, semnătura. Aici, pe web, le pregătești și vezi rezultatele. Modulul pornește după ce conectezi telefonul la contul tău.</p>
      </div>
      <div className="inActRow">
        <section className="inActDark">
          <b>Aplicația UVALO</b>
          <p>Disponibilă în curând pentru Android și iPhone. O deschizi pe telefon de la</p>
          <span className="inActUrl">app.uvalo.ro/inspectii</span>
          <span className="inActStores"><span>App Store · în curând</span><span>Google Play · în curând</span></span>
        </section>
        <section className="card inActSteps">
          <b>Trei pași</b>
          <ol>
            <li><span>1</span><p><b>Instalează aplicația</b> pe telefon.</p></li>
            <li><span>2</span><p><b>Conectează-te</b> cu emailul contului UVALO sau cu codul de mai jos.</p></li>
            <li><span>3</span><p><b>Permite camera și locația</b>: pozele primesc ora și coordonatele, iar inspecția știe dacă ești la adresă.</p></li>
          </ol>
          <div className="inActCode">
            {code && left > 0 ? (
              <>
                <span><small>Cod de conectare · mai e valabil {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</small><b>{code.slice(0, 3)} {code.slice(3)}</b></span>
                <span className="inActWait"><i />Aștept telefonul…</span>
              </>
            ) : (
              <button type="button" className="btn btnNavy" disabled={busy} onClick={() => call("pair_code")}>Arată codul de conectare</button>
            )}
          </div>
          {testMode && (
            <div className="note">
              <b>Mod de test.</b> Aplicația de telefon nu e încă gata. Poți continua fără telefon ca să încerci partea web; inspecțiile se pot „simula” din fișa lor.
              <div className="actions" style={{ marginTop: 10 }}><button type="button" className="btn btnGold btnSm" disabled={busy} onClick={() => call("test_device")}>Continuă fără telefon (test)</button></div>
            </div>
          )}
          {msg && <p className="note" role="alert">{msg}</p>}
        </section>
      </div>
    </div>
  );
}
