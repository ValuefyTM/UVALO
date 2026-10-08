"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanUpload, Uat } from "@/lib/plans";
import { roDate } from "@/lib/plan-format";

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
const mb = (n: number) => `${(n / 1048576).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB`;

/** The UAT and the date from the parcel layer of an ANCPI export ("T_A1S1_CHEVERESU MARE_2026-07-13"), read from the start of the file. */
async function detect(file: File) {
  const text = await file.slice(0, 16 * 1048576).text();
  const m = text.match(/T_A1S1_([^\r\n]+?)_(\d{4}-\d{2}-\d{2})/);
  return m ? { uat: m[1].trim(), date: m[2] } : null;
}

/** Choose a DXF, check the UAT, upload: the browser compresses it (about 8 times smaller) before sending. */
export function PlanUploader({ uats, ready }: { uats: Uat[]; ready: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [found, setFound] = useState<{ uat: string; date: string } | null>(null);
  const [key, setKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [step, setStep] = useState<"" | "zip" | "up">("");
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const pick = async (f: File | null) => {
    setMsg(""); setFile(f); setFound(null); setKey(""); setNewName(""); setNewKey("");
    if (!f) return;
    if (!/\.dxf$/i.test(f.name)) return setMsg("Alege fișierul .dxf exportat din ANCPI (nu arhivat).");
    const d = await detect(f);
    if (!d) return setMsg("Nu găsesc în fișier stratul cu parcele (T_A1S1_<UAT>_<data>). Este exportul DXF de la ANCPI?");
    setFound(d);
    const k = slug(d.uat);
    if (uats.some((u) => u.key === k)) setKey(k);
    else { setKey("__new"); setNewName(title(d.uat)); setNewKey(k); }
  };

  const send = async () => {
    if (!file) return;
    const isNew = key === "__new";
    const k = isNew ? slug(newKey || newName) : key;
    if (!k) return setMsg("Alege UAT-ul.");
    if (isNew && !newName.trim()) return setMsg("Scrie numele UAT-ului nou, cu diacritice.");
    setMsg(""); setStep("zip"); setPct(0);
    let body: Blob;
    try {
      body = await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    } catch {
      setStep(""); return setMsg("Browserul nu a putut comprima fișierul. Folosește un Chrome, Edge, Safari sau Firefox actualizat.");
    }
    setStep("up");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/plans");
    xhr.setRequestHeader("Content-Type", "application/gzip");
    xhr.setRequestHeader("x-plan-key", k);
    xhr.setRequestHeader("x-plan-name", encodeURIComponent(isNew ? newName.trim() : ""));
    xhr.setRequestHeader("x-plan-file", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-plan-size", String(file.size));
    if (found) xhr.setRequestHeader("x-plan-date", found.date);
    xhr.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let d: { error?: string } = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) return location.reload();
      setStep(""); setMsg(d.error || `Încărcarea a eșuat (HTTP ${xhr.status}).`);
    };
    xhr.onerror = () => { setStep(""); setMsg("Conexiunea s-a întrerupt. Încearcă din nou."); };
    xhr.send(body);
  };

  const known = uats.find((u) => u.key === key);
  return (
    <section className="card">
      <h2>Încarcă un plan nou</h2>
      <p className="hint">Exportul DXF de la ANCPI, oricât de mare: browserul îl comprimă înainte de trimitere. Datele existente nu se șterg: se adaugă parcelele și construcțiile noi și se actualizează cele cu același număr.</p>
      {!ready && <div role="alert" className="error">Încărcarea nu funcționează încă: lipsește PLANS_GITHUB_TOKEN din setările Cloudflare ale Tools (vezi README).</div>}
      <label className="field">Fișier DXF
        <input ref={input} className="input" type="file" accept=".dxf" disabled={!!step} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </label>
      {file && found && (
        <>
          <p className="hint">În fișier: <b>{found.uat}</b> · date cadastrale la <b>{roDate(found.date)}</b> · {mb(file.size)}</p>
          <label className="field">UAT
            <select className="select" value={key} disabled={!!step} onChange={(e) => {
              setKey(e.target.value);
              if (e.target.value === "__new" && !newName && found) { setNewName(title(found.uat)); setNewKey(slug(found.uat)); }
            }}>
              <option value="" disabled>Alege UAT-ul</option>
              {uats.map((u) => <option key={u.key} value={u.key}>{u.name}{u.date ? ` · plan la ${roDate(u.date)}` : ""}</option>)}
              <option value="__new">UAT nou (nu e încă în localizator)</option>
            </select>
          </label>
          {key === "__new" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label className="field" style={{ flex: "1 1 200px" }}>Nume UAT <small>(cu diacritice, cum apare în localizator)</small>
                <input className="input" value={newName} disabled={!!step} onChange={(e) => { setNewName(e.target.value); setNewKey(slug(e.target.value)); }} />
              </label>
              <label className="field" style={{ flex: "1 1 160px" }}>Cheie <small>(fără diacritice)</small>
                <input className="input" value={newKey} disabled={!!step} onChange={(e) => setNewKey(e.target.value)} />
              </label>
            </div>
          )}
          {key === "__new" && <p className="hint">Un UAT nou apare doar cu parcele și construcții: exportul nu are numere topo și limite de intravilan.</p>}
          {known && known.date && found.date < known.date && <div role="alert" className="error">Atenție: planul din localizator ({roDate(known.date)}) este mai nou decât acesta.</div>}
        </>
      )}
      {msg && <div role="alert" className="error">{msg}</div>}
      <div className="actions">
        <button type="button" className="btn btnNavy" disabled={!file || !found || !key || !!step || !ready} onClick={send}>
          {step === "zip" ? "Se comprimă…" : step === "up" ? `Se încarcă… ${pct}%` : "Încarcă și convertește"}
        </button>
      </div>
    </section>
  );
}

const STATUS: Record<PlanUpload["status"], [string, string]> = {
  converting: ["Se convertește", "pillInfo"], ready: ["Gata de publicat", "pillWarn"], publishing: ["Se publică", "pillInfo"],
  published: ["Publicat", "pillOk"], failed: ["Eroare", "pillErr"], discarded: ["Anulat", ""],
};

/** The uploads and their state; asks for news every 10 s while one is converting or being published. */
export function PlanList({ initial }: { initial: PlanUpload[] }) {
  const [list, setList] = useState(initial);
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState("");
  const running = list.some((u) => u.status === "converting" || u.status === "publishing");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/admin/plans").catch(() => null);
      const d = (await r?.json().catch(() => null)) as { uploads?: PlanUpload[]; warning?: string | null } | null;
      if (d?.uploads) setList(d.uploads);
      setWarning(d?.warning ?? "");
    }, 10000);
    return () => clearInterval(t);
  }, [running]);

  const act = async (id: string, action: "publish" | "discard") => {
    if (action === "discard" && !confirm("Renunți la acest plan? Localizatorul rămâne cum este.")) return;
    setBusy(id);
    const r = await fetch(`/api/admin/plans/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string };
    setBusy("");
    if (!r?.ok) return alert(d?.error || "Nu am putut face asta. Încearcă din nou.");
    location.reload();
  };

  if (!list.length) return <section className="card"><h2>Planuri încărcate</h2><p className="hint">Niciun plan încărcat încă din admin.</p></section>;
  return (
    <section className="card">
      <h2>Planuri încărcate</h2>
      {warning && <div role="alert" className="error">{warning}</div>}
      <ul className="docList">
        {list.map((u) => {
          const [label, cls] = STATUS[u.status];
          return (
            <li key={u.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span className="who">
                  <b>{u.uat_name}{u.new_uat ? " (UAT nou)" : ""}</b>
                  <small>{[u.plan_date && `date la ${roDate(u.plan_date)}`, u.file_name, mb(u.size), u.by_name, new Date(u.created_at).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Bucharest" })].filter(Boolean).join(" · ")}</small>
                </span>
                <span className={`pill ${cls}`}><i />{label}</span>
              </div>
              {u.status === "converting" && <p className="hint">Conversia durează câteva minute. Pagina se actualizează singură.</p>}
              {u.status === "publishing" && <p className="hint">Se pune în localizator și se face deploy-ul (câteva minute).</p>}
              {u.summary && <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "var(--cream)", borderRadius: 10, padding: "10px 12px" }}>{u.summary}</pre>}
              {u.error && <div className="error">{u.error}</div>}
              <div className="actions" style={{ justifyContent: "flex-start" }}>
                {(u.status === "ready" || (u.status === "failed" && u.summary)) && (
                  <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => act(u.id, "publish")}>{busy === u.id ? "…" : u.status === "failed" ? "Publică din nou" : "Publică în localizator"}</button>
                )}
                {(u.status === "ready" || u.status === "failed") && <button type="button" className="btn btnGhost btnSm" disabled={!!busy} onClick={() => act(u.id, "discard")}>Renunță</button>}
                {u.run_url && <a className="link" style={{ fontSize: 13 }} href={u.run_url} target="_blank" rel="noreferrer">Jurnal GitHub</a>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
