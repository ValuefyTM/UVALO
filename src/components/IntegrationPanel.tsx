"use client";
// "Firma mea" → Integrare: API keys for the firm's own software (e.g. its CRM), each with its webhook. A key and a webhook
// secret are shown once, when created; then only their first characters.
import { useEffect, useState } from "react";

type Hook = { event: string; status: number | null; error: string | null; at: string };
type Key = { id: string; name: string; prefix: string; webhook_url: string | null; created_at: string; last_used_at: string | null; by_name: string | null; hooks: Hook[] };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "") : "niciodată");

async function post(body: object) {
  const r = await fetch("/api/org/integration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const d = (await r?.json().catch(() => ({}))) as { error?: string; key?: string; secret?: string };
  return r?.ok ? d : { error: d?.error ?? "Nu am putut salva. Încearcă din nou." };
}

/** How to connect the UVALO MCP server (Claude and other assistants) with a firm key. */
function McpHelp({ app }: { app: string }) {
  const [open, setOpen] = useState(false);
  const url = `${app}/api/mcp`;
  return (
    <div className="intMcp">
      <p className="hint">
        <b>MCP pentru Claude.</b> Aceeași cheie deschide și serverul MCP al UVALO: Claude (Desktop, claude.ai, Claude Code) poate căuta imobile după nr. cadastral,
        coordonate sau adresă, poate citi conturul, construcțiile, vecinii, zona de impozitare și grila notarială 2026 — deocamdată doar Localizatorul cadastral.{" "}
        <button type="button" className="lnk" onClick={() => setOpen(!open)}>{open ? "Ascunde instrucțiunile" : "Cum se conectează"}</button>
      </p>
      {open && (
        <div className="intMcpBody">
          <p className="hint"><b>claude.ai</b> (Setări → Conectori → Adaugă conector personalizat): adresa cu cheia în ea, fără OAuth:</p>
          <pre className="mono">{`${url}/uvk_…`}</pre>
          <p className="hint"><b>Claude Code</b></p>
          <pre className="mono">{`claude mcp add --transport http uvalo ${url}/uvk_…`}</pre>
          <p className="hint"><b>Claude Desktop</b> (claude_desktop_config.json; cheia în adresă, nu în antet — antetele cu spații se pierd):</p>
          <pre className="mono">{JSON.stringify({ mcpServers: { uvalo: { command: "npx", args: ["-y", "mcp-remote", `${url}/uvk_…`, "--transport", "http-only"] } } }, null, 2)}</pre>
          <p className="hint">Pentru alte aplicații: <code className="mono">{url}</code> cu antetul <code className="mono">Authorization: Bearer uvk_…</code> (sau <code className="mono">?key=uvk_…</code>).</p>
          <p className="hint">Instrumente: <code className="mono">localitati</code>, <code className="mono">parcela</code>, <code className="mono">parcela_la_coordonate</code>,{" "}
            <code className="mono">parcela_la_adresa</code>, <code className="mono">grila_notariala</code>, <code className="mono">conversie_coordonate</code>. Folosirea se vede în Activitate (acțiunile „mcp_…”).</p>
        </div>
      )}
    </div>
  );
}

export function IntegrationPanel({ app, inspectii = true }: { app: string; inspectii?: boolean }) {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState("");
  const [shown, setShown] = useState<{ label: string; value: string } | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const r = await fetch("/api/org/integration").then((x) => x.json() as Promise<{ keys?: Key[] }>).catch(() => ({ keys: [] as Key[] }));
    setKeys(r.keys ?? []);
    setUrls(Object.fromEntries((r.keys ?? []).map((k) => [k.id, k.webhook_url ?? ""])));
  };
  useEffect(() => { void load(); }, []);
  const run = async (body: object, label?: string) => {
    setBusy(true); setMsg("");
    const d = await post(body);
    setBusy(false);
    if (d.error) return setMsg(d.error);
    if (d.key) setShown({ label: "Cheia API (o vezi doar acum — copiaz-o în aplicația firmei)", value: d.key });
    else if (d.secret) setShown({ label: "Secretul webhook-ului (îl vezi doar acum — cu el verifici semnătura apelurilor)", value: d.secret });
    else if (label) setMsg(label);
    await load();
  };

  return (
    <section className="card" id="integrare">
      <h2>Integrare <span className="hint" style={{ fontWeight: 400 }}>· aplicația firmei (CRM) și Claude (MCP)</span></h2>
      {inspectii ? (
        <p className="hint">Cu o cheie API, aplicația firmei trimite inspecții evaluatorilor (după legitimația ANEVAR; le primesc direct pe telefon), ține fișele firmei
          sincronizate și citește fișele finalizate. La fiecare schimbare UVALO apelează webhook-ul, semnat cu secretul lui.</p>
      ) : (
        <p className="hint">Cu o cheie API, aplicația firmei sau Claude folosesc datele UVALO. Webhook-ul și inspecțiile prin API cer modulul Inspecții.</p>
      )}
      <McpHelp app={app} />
      {shown && (
        <div className="note intShown">
          <b>{shown.label}</b>
          <code className="mono">{shown.value}</code>
          <span className="actions">
            <button type="button" className="btn btnNavy btnSm" onClick={() => navigator.clipboard?.writeText(shown.value)}>Copiază</button>
            <button type="button" className="btn btnGhost btnSm" onClick={() => setShown(null)}>Am salvat-o</button>
          </span>
        </div>
      )}
      {keys === null ? <p className="hint">Se încarcă…</p> : keys.length === 0 ? <p className="hint">Nicio cheie încă.</p> : (
        <ul className="intKeys">
          {keys.map((k) => (
            <li key={k.id}>
              <div className="intHead">
                <span><b>{k.name}</b> <code className="mono">{k.prefix}…</code></span>
                <small className="hint">creată {when(k.created_at)}{k.by_name ? ` de ${k.by_name}` : ""} · folosită {when(k.last_used_at)}</small>
                <button type="button" className="btn btnGhost btnSm" disabled={busy}
                  onClick={() => { if (confirm(`Revoci cheia „${k.name}”? Aplicația care o folosește nu mai poate trimite inspecții.`)) void run({ action: "revoke", id: k.id }, "Cheia a fost revocată."); }}>Revocă</button>
              </div>
              <form className="intHook" onSubmit={(e) => { e.preventDefault(); void run({ action: "webhook", id: k.id, url: urls[k.id] ?? "" }, "Webhook-ul a fost salvat."); }}>
                <label className="field">Webhook (URL)
                  <input className="input mono" value={urls[k.id] ?? ""} onChange={(e) => setUrls({ ...urls, [k.id]: e.target.value })} placeholder="https://crm.firma.ro/api/integrations/uvalo/webhook" />
                </label>
                <button type="submit" className="btn btnNavy btnSm" disabled={busy}>Salvează</button>
                {k.webhook_url && <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => { if (confirm("Generezi un secret nou? Cel vechi nu mai e valabil.")) void run({ action: "webhook", id: k.id, url: k.webhook_url, new_secret: true }); }}>Secret nou</button>}
              </form>
              {k.hooks.length > 0 && (
                <ul className="intHooks">
                  {k.hooks.map((h, i) => <li key={i}><span className={`pill ${h.status && h.status < 300 ? "pillOk" : "pillErr"}`}><i />{h.status ?? "fără răspuns"}</span><span className="mono">{h.event}</span><small className="hint">{when(h.at)}{h.error ? ` · ${h.error}` : ""}</small></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="intNew" onSubmit={(e) => { e.preventDefault(); void run({ action: "create", name }); setName(""); }}>
        <label className="field">Cheie nouă<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. CRM firmă" /></label>
        <button type="submit" className="btn btnGold btnSm" disabled={busy}>Generează cheia</button>
      </form>
      {msg && <p className="hint" role="status">{msg}</p>}
    </section>
  );
}
