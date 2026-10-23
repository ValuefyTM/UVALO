"use client";

import { useEffect, useState } from "react";
import { qrSvg } from "./mobile/InstallHint";

/**
 * Inspecții without a connected phone: the module needs the UVALO Inspecții app (a PWA on inspectii.uvalo.ro, installed on
 * the phone). The phone signs in with the account's email or by scanning the QR below (a long one-time token in the QR, an 8-digit code to type; 10 minutes); the
 * module starts once a phone has signed in (the page checks every 3 s). In test mode the super-admin can go on without a phone.
 */
export function InspActivate({ testMode, appUrl }: { testMode: boolean; appUrl: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null); // in the QR: a long token that cannot be guessed
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const host = appUrl.replace(/^https?:\/\//, "");
  useEffect(() => {
    if (!left) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  // waits for the phone (by QR or by email in the app): the module opens as soon as one is connected
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "device_status" }) }).catch(() => null);
      const j = r?.ok ? ((await r.json().catch(() => ({}))) as { devices?: number }) : {};
      if ((j.devices ?? 0) > 0) location.reload();
    }, 3000);
    return () => clearInterval(t);
  }, []);
  async function call(action: string) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) throw new Error(j.error || "Nu a mers.");
      if (action === "pair_code") { setCode(j.code); setToken(j.token ?? j.code); setLeft(600); } else location.reload();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  const live = code && left > 0;
  return (
    <div className="inAct">
      <div className="inActHead">
        <span className="eyebrow">Inspecții · activare</span>
        <h2>Instalează aplicația UVALO Inspecții pe telefon ca să folosești Inspecțiile</h2>
        <p>Inspecțiile se fac pe telefon: fișa, fotografiile cu ora și locul, semnătura. Aici, pe web, le pregătești și vezi rezultatele. Modulul pornește după ce te conectezi o dată din aplicația de pe telefon.</p>
      </div>
      <div className="inActRow">
        <section className="inActDark">
          <b>Scanează cu telefonul</b>
          {live ? (
            <>
              <span className="inActQr" dangerouslySetInnerHTML={{ __html: qrSvg(`${appUrl}/?pair=${encodeURIComponent(token ?? code ?? "")}`, 4) }} />
              <p>Deschide camera telefonului și îndreaptă-o spre cod. Aplicația se deschide conectată la contul tău.</p>
            </>
          ) : (
            <>
              <p>Codul QR te conectează direct, fără email. Sau deschide pe telefon</p>
              <span className="inActUrl">{host}</span>
              <p>și intră cu emailul contului UVALO.</p>
            </>
          )}
          <span className="inActStores"><span>iPhone · din Safari</span><span>Android · din Chrome</span></span>
        </section>
        <section className="card inActSteps">
          <b>Trei pași</b>
          <ol>
            <li><span>1</span><p><b>Deschide {host}</b> pe telefon (sau scanează codul QR) și <b>pune aplicația pe ecranul principal</b>: pagina îți arată cum, după telefon.</p></li>
            <li><span>2</span><p><b>Conectează-te</b> cu codul QR de aici sau cu emailul contului UVALO.</p></li>
            <li><span>3</span><p><b>Permite camera și locația</b>: pozele primesc ora și coordonatele, iar inspecția știe dacă ești la adresă.</p></li>
          </ol>
          <div className="inActCode">
            {live ? (
              <>
                <span><small>Cod de conectare · mai e valabil {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</small><b>{code.slice(0, 4)} {code.slice(4)}</b></span>
                <span className="inActWait"><i />Aștept telefonul…</span>
              </>
            ) : (
              <>
                <button type="button" className="btn btnNavy" disabled={busy} onClick={() => call("pair_code")}>Arată codul QR de conectare</button>
                <span className="inActWait"><i />Pagina se deschide singură după conectarea telefonului</span>
              </>
            )}
          </div>
          {testMode && (
            <div className="note">
              <b>Mod de test.</b> Poți continua fără telefon ca să încerci partea web; inspecțiile se pot „simula” din fișa lor.
              <div className="actions" style={{ marginTop: 10 }}><button type="button" className="btn btnGold btnSm" disabled={busy} onClick={() => call("test_device")}>Continuă fără telefon (test)</button></div>
            </div>
          )}
          {msg && <p className="note" role="alert">{msg}</p>}
        </section>
      </div>
    </div>
  );
}
