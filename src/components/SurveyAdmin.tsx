"use client";

// Admin → Chestionar → Setări: the settings of the active questionnaire (on / off, threshold, stop, the options of step 3)
// and „Chestionar nou” (a new id: everyone eligible gets it again).
import { useState } from "react";
import type { SurveySettings } from "@/lib/survey-shared";

export function SurveyAdmin({ s }: { s: SurveySettings }) {
  const [f, setF] = useState({ on: s.on, min_actions: String(s.min_actions), stop_n: String(s.stop_n || ""), stop_at: s.stop_at, wants: s.wants.join("\n") });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json().then((v: unknown) => ({ ok: x.ok, j: v as { error?: string } }))).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setMsg(r?.j.error || "Nu am putut salva.");
    location.reload();
  };
  return (
    <form className="spForm" onSubmit={(e) => { e.preventDefault(); void post({ action: "settings", on: f.on, min_actions: Number(f.min_actions), stop_n: Number(f.stop_n || 0), stop_at: f.stop_at, wants: f.wants.split("\n").map((x) => x.trim()).filter(Boolean) }); }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <label className="field"><span>Stare</span>
          <select className="select" value={f.on ? "1" : "0"} onChange={(e) => setF({ ...f, on: e.target.value === "1" })}><option value="1">Activ · se afișează</option><option value="0">Oprit</option></select></label>
        <label className="field"><span>Cui îi apare: de la … acțiuni</span><input className="input" type="number" min={0} value={f.min_actions} onChange={(e) => setF({ ...f, min_actions: e.target.value })} /></label>
        <label className="field"><span>Se oprește la … răspunsuri (gol = niciodată)</span><input className="input" type="number" min={0} value={f.stop_n} onChange={(e) => setF({ ...f, stop_n: e.target.value })} /></label>
        <label className="field"><span>Se oprește pe (gol = niciodată)</span><input className="input" type="date" value={f.stop_at} onChange={(e) => setF({ ...f, stop_at: e.target.value })} /></label>
      </div>
      <label className="field"><span>Opțiunile pasului 3 „Ce ți-ar fi cel mai util” · una pe rând, „titlu · explicație”</span>
        <textarea className="textarea" rows={5} value={f.wants} onChange={(e) => setF({ ...f, wants: e.target.value })} /></label>
      <p className="hint" style={{ margin: 0, fontSize: 12 }}>Super-adminii nu primesc chestionarul. Id-ul chestionarului: <b>{s.id}</b>{s.started_at ? ` · pornit ${new Date(s.started_at).toLocaleDateString("ro-RO")}` : ""}. Schimbarea opțiunilor după ce au răspuns unii amestecă statisticile pasului 3: pentru întrebări noi, pornește un chestionar nou.</p>
      {msg && <div className="error" role="alert">{msg}</div>}
      <div className="actions">
        <button type="submit" className="btn btnNavy" disabled={busy}>Salvează</button>
        <button type="button" className="btn btnGhost" disabled={busy} onClick={() => { if (confirm("Pornești un chestionar nou? Toți cei eligibili îl vor primi din nou la următoarea logare; răspunsurile de acum rămân la chestionarul vechi.")) void post({ action: "new" }); }}>+ Chestionar nou</button>
        <a className="btn btnGhost" href="/api/admin/survey?csv=1">Exportă CSV</a>
      </div>
    </form>
  );
}
