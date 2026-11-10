"use client";
// "Contul meu" → "UVALO în Claude": the MCP address to paste into Claude, the steps, and the apps already connected (with
// "Deconectează"). The connection itself is OAuth: Claude opens /oauth/authorize, the person signs in and allows it.
import { useEffect, useState } from "react";

type App = { id: string; client_name: string | null; created_at: string; expires_at: string; last_used_at: string | null };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "") : "niciodată");

export function ClaudeCard({ app }: { app: string }) {
  const url = `${app}/api/mcp`;
  const [apps, setApps] = useState<App[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false);
  const load = () => fetch("/api/account/apps").then((r) => r.json() as Promise<{ apps?: App[] }>).then((d) => setApps(d.apps ?? [])).catch(() => setApps([]));
  useEffect(() => { void load(); }, []);
  const copy = () => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const drop = async (a: App) => {
    if (!confirm(`Deconectezi „${a.client_name || "aplicația"}”? Va trebui să o conectezi din nou din Claude.`)) return;
    await fetch("/api/account/apps", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) });
    void load();
  };
  return (
    <section className="card" id="claude" style={{ gap: 10 }}>
      <span className="eyebrow">UVALO în Claude</span>
      <p className="hint" style={{ margin: 0 }}>Claude poate căuta imobile după nr. cadastral, coordonate sau adresă și poate citi conturul, construcțiile, vecinii, zona de impozitare
        și grila notarială 2026, direct în conversație. Deocamdată doar Localizatorul cadastral.</p>
      <div className="clUrl">
        <code className="mono">{url}</code>
        <button type="button" className="btn btnNavy btnSm" onClick={copy}>{copied ? "✓ Copiat" : "Copiază adresa"}</button>
      </div>
      <ol className="clSteps">
        <li><b>claude.ai</b> sau <b>Claude Desktop</b>: Setări → Conectori → „Adaugă conector personalizat” → nume <i>UVALO</i>, adresa de mai sus → Adaugă → <b>Conectează</b>.</li>
        <li>Se deschide UVALO: te autentifici (dacă nu ești deja) și apeși <b>Permite</b>. Gata.</li>
      </ol>
      <button type="button" className="lnk clMore" onClick={() => setMore(!more)}>{more ? "Mai puțin" : "Claude Code și alte aplicații"}</button>
      {more && (
        <div className="clMoreBody">
          <p className="hint"><b>Claude Code</b>: <code className="mono">{`claude mcp add --transport http uvalo ${url}`}</code>, apoi <code className="mono">/mcp</code> → Authenticate.</p>
          <p className="hint">Orice client MCP cu OAuth (Streamable HTTP) se conectează la fel. Pentru aplicații fără OAuth, firma poate folosi cheia API din „Firma mea → Integrare”.</p>
        </div>
      )}
      {apps === null ? <small className="muted">Se încarcă…</small> : apps.length === 0 ? <small className="muted">Nicio aplicație conectată încă.</small> : (
        <ul className="clApps">
          {apps.map((a) => (
            <li key={a.id}>
              <span><b>{a.client_name || "Aplicație"}</b><small className="hint"> · conectată {when(a.created_at)} · folosită {when(a.last_used_at)}</small></span>
              <button type="button" className="btn btnGhost btnSm" onClick={() => drop(a)}>Deconectează</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
