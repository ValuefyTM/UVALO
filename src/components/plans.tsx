"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanUpload, Uat } from "@/lib/plans";
import { roDate } from "@/lib/plan-format";

const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
const mb = (n: number) => `${(n / 1048576).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB`;

/** The UAT and the date from the parcel layer of an ANCPI export ("T_A1S1_CHEVERESU MARE_2026-07-13"), read from the start of the file. */
async function detect(file: File) {
  const text = await file.slice(0, 16 * 1048576).text();
  const m = text.match(/T_A1S1_([^\r\n]+?)_(\d{4}-\d{2}-\d{2})/);
  return m ? { uat: m[1].trim(), date: m[2] } : null;
}

export const COUNTIES_RO = ["Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani", "Brăila", "Brașov", "București", "Buzău", "Călărași",
  "Caraș-Severin", "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov",
  "Maramureș", "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Sălaj", "Satu Mare", "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vâlcea", "Vaslui", "Vrancea"];

type Item = {
  file: File; uat: string; date: string; key: string; // key "" = to choose, "__new" = a UAT not in the locator yet
  newName: string; newCounty: string; note: string;
  state: "" | "zip" | "up" | "done" | "error"; pct: number; msg: string;
};

/** The UATs grouped by county, for a <select>. */
function UatOptions({ uats }: { uats: Uat[] }) {
  const by = new Map<string, Uat[]>();
  for (const u of uats) by.set(u.county, [...(by.get(u.county) ?? []), u]);
  return <>{[...by].map(([c, list]) => <optgroup key={c} label={`Județul ${c}`}>{list.map((u) => <option key={u.key} value={u.key}>{u.name}{u.date ? ` · plan la ${roDate(u.date)}` : ""}</option>)}</optgroup>)}</>;
}

/** Choose one or more DXF files, check each UAT, upload them one after another (each is compressed in the browser, about 8 times smaller). */
export function PlanUploader({ uats, ready }: { uats: Uat[]; ready: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const set = (i: number, p: Partial<Item>) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const pick = async (files: FileList | null) => {
    setMsg("");
    const out: Item[] = [];
    const bad: string[] = [];
    for (const f of Array.from(files ?? [])) {
      if (!/\.dxf$/i.test(f.name)) { bad.push(`${f.name}: nu este .dxf (nu îl arhiva)`); continue; }
      const d = await detect(f);
      if (!d) { bad.push(`${f.name}: nu găsesc stratul cu parcele (T_A1S1_<UAT>_<data>)`); continue; }
      const same = uats.filter((u) => slug(u.name) === slug(d.uat));
      const it: Item = { file: f, uat: d.uat, date: d.date, key: "", newName: "", newCounty: "", note: "", state: "", pct: 0, msg: "" };
      if (same.length === 1) it.key = same[0].key;
      else if (same.length > 1) it.note = `„${title(d.uat)}” există în mai multe județe: alege-l pe cel corect.`;
      else { it.key = "__new"; it.newName = title(d.uat); }
      out.push(it);
    }
    setItems(out);
    if (bad.length) setMsg(bad.join(" · "));
  };

  const keyOf = (it: Item) => {
    if (it.key !== "__new") return it.key;
    const k = slug(it.newName);
    return uats.some((u) => u.key === k) ? `${k}-${slug(it.newCounty)}` : k;
  };
  const problem = (it: Item) => {
    if (!it.key) return "Alege UAT-ul.";
    if (it.key === "__new" && !it.newName.trim()) return "Scrie numele UAT-ului nou.";
    if (it.key === "__new" && !it.newCounty.trim()) return "Alege județul.";
    return "";
  };
  const keys = items.filter((x) => x.state !== "done").map(keyOf);
  const dup = keys.find((k, i) => k && keys.indexOf(k) !== i);

  const upload = (it: Item, i: number) => new Promise<boolean>(async (resolve) => {
    set(i, { state: "zip", msg: "" });
    let body: Blob;
    try {
      body = await new Response(it.file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    } catch {
      set(i, { state: "error", msg: "Browserul nu a putut comprima fișierul. Folosește un Chrome, Edge, Safari sau Firefox actualizat." });
      return resolve(false);
    }
    set(i, { state: "up", pct: 0 });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/plans");
    xhr.setRequestHeader("Content-Type", "application/gzip");
    xhr.setRequestHeader("x-plan-key", keyOf(it));
    xhr.setRequestHeader("x-plan-name", encodeURIComponent(it.key === "__new" ? it.newName.trim() : ""));
    xhr.setRequestHeader("x-plan-county", encodeURIComponent(it.key === "__new" ? it.newCounty.trim() : ""));
    xhr.setRequestHeader("x-plan-file", encodeURIComponent(it.file.name));
    xhr.setRequestHeader("x-plan-size", String(it.file.size));
    xhr.setRequestHeader("x-plan-date", it.date);
    xhr.upload.onprogress = (e) => e.lengthComputable && set(i, { pct: Math.round((e.loaded / e.total) * 100) });
    xhr.onload = () => {
      let d: { error?: string } = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      const ok = xhr.status >= 200 && xhr.status < 300;
      set(i, ok ? { state: "done" } : { state: "error", msg: d.error || `Încărcarea a eșuat (HTTP ${xhr.status}).` });
      resolve(ok);
    };
    xhr.onerror = () => { set(i, { state: "error", msg: "Conexiunea s-a întrerupt. Încearcă din nou." }); resolve(false); };
    xhr.send(body);
  });

  const send = async () => {
    const p = items.map(problem).find((x, i) => x && items[i].state !== "done");
    if (p) return setMsg(p);
    if (dup) return setMsg("Două fișiere pentru același UAT: încarcă-l doar pe cel mai nou.");
    setMsg(""); setBusy(true);
    let all = true;
    for (const [i, it] of items.entries()) if (it.state !== "done") all = (await upload(it, i)) && all;
    setBusy(false);
    if (all) location.reload();
  };

  const STATE: Record<Item["state"], string> = { "": "", zip: "Se comprimă…", up: "Se încarcă…", done: "Încărcat ✓", error: "" };
  return (
    <section className="card">
      <h2>Încarcă planuri noi</h2>
      <p className="hint">Exporturile DXF de la ANCPI, oricât de mari și oricâte deodată: browserul le comprimă înainte de trimitere. Datele existente nu se șterg: se adaugă parcelele și construcțiile noi și se actualizează cele cu același număr.</p>
      {!ready && <div role="alert" className="error">Încărcarea nu funcționează încă: lipsește PLANS_GITHUB_TOKEN din setările Cloudflare ale Tools (vezi README).</div>}
      <GithubCheck />
      <label className="field">Fișiere DXF <small>(poți alege mai multe)</small>
        <input ref={input} className="input" type="file" accept=".dxf" multiple disabled={busy} onChange={(e) => pick(e.target.files)} />
      </label>
      {items.length > 0 && (
        <ul className="docList">
          {items.map((it, i) => {
            const known = uats.find((u) => u.key === it.key);
            return (
              <li key={i} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span className="who"><b>{it.file.name}</b><small>În fișier: {it.uat} · date cadastrale la {roDate(it.date)} · {mb(it.file.size)}</small></span>
                  {it.state && it.state !== "error" && <span className={`pill ${it.state === "done" ? "pillOk" : "pillInfo"}`}><i />{it.state === "up" ? `Se încarcă… ${it.pct}%` : STATE[it.state]}</span>}
                </div>
                {it.state !== "done" && (
                  <>
                    <label className="field">UAT
                      <select className="select" value={it.key} disabled={busy} onChange={(e) => set(i, { key: e.target.value, note: "", ...(e.target.value === "__new" && !it.newName ? { newName: title(it.uat) } : {}) })}>
                        <option value="" disabled>Alege UAT-ul</option>
                        <UatOptions uats={uats} />
                        <option value="__new">UAT nou (nu e încă în localizator)</option>
                      </select>
                    </label>
                    {it.note && <p className="hint">{it.note}</p>}
                    {it.key === "__new" && (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <label className="field" style={{ flex: "1 1 180px" }}>Nume UAT <small>(cu diacritice)</small>
                          <input className="input" value={it.newName} disabled={busy} onChange={(e) => set(i, { newName: e.target.value })} />
                        </label>
                        <label className="field" style={{ flex: "1 1 160px" }}>Județ
                          <select className="select" value={it.newCounty} disabled={busy} onChange={(e) => set(i, { newCounty: e.target.value })}>
                            <option value="" disabled>Alege județul</option>
                            {COUNTIES_RO.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </label>
                      </div>
                    )}
                    {it.key === "__new" && <p className="hint">Un UAT nou apare doar cu parcele și construcții: exportul nu are numere topo și limite de intravilan.</p>}
                    {known?.date && it.date < known.date && <div role="alert" className="error">Atenție: planul din localizator ({roDate(known.date)}) este mai nou decât acesta.</div>}
                  </>
                )}
                {it.msg && <div role="alert" className="error">{it.msg}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {msg && <div role="alert" className="error">{msg}</div>}
      <div className="actions">
        <button type="button" className="btn btnNavy" disabled={!items.some((x) => x.state !== "done") || busy || !ready} onClick={send}>
          {busy ? "Se încarcă…" : items.length > 1 ? `Încarcă și convertește (${items.filter((x) => x.state !== "done").length})` : "Încarcă și convertește"}
        </button>
      </div>
    </section>
  );
}

/** Checks the GitHub token from where it runs (the Tools worker). */
export function GithubCheck() {
  const [steps, setSteps] = useState<{ label: string; ok: boolean; detail: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await fetch("/api/admin/plans?check=1").catch(() => null);
    const d = (await r?.json().catch(() => null)) as { steps?: { label: string; ok: boolean; detail: string }[]; error?: string } | null;
    setSteps(d?.steps ?? [{ label: "Verificare", ok: false, detail: d?.error || "Nu am primit răspuns." }]);
    setBusy(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div><button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={run}>{busy ? "Se verifică…" : "Verifică legătura cu GitHub"}</button></div>
      {steps && (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          {steps.map((x, i) => <li key={i}><b style={{ color: x.ok ? "var(--ok-text)" : "var(--err)" }}>{x.ok ? "✓" : "✗"}</b> {x.label}: <span className={x.ok ? "muted" : "error"}>{x.detail}</span></li>)}
          {steps.length === 4 && steps.every((x) => x.ok) && <li className="muted">Totul e în regulă. Dreptul „Actions: write” se vede la prima încărcare.</li>}
        </ul>
      )}
    </div>
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
  const readyIds = list.filter((u) => u.status === "ready").map((u) => u.id);
  const retryIds = list.filter((u) => u.status === "failed" && !u.summary && u.asset_id).map((u) => u.id);
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

  const act = async (id: string, action: "publish" | "discard" | "retry", ids?: string[]) => {
    if (action === "discard" && !confirm("Renunți la acest plan? Localizatorul rămâne cum este.")) return;
    setBusy(id);
    const r = await fetch(`/api/admin/plans/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string };
    setBusy("");
    if (!r?.ok) return alert(d?.error || "Nu am putut face asta. Încearcă din nou.");
    location.reload();
  };

  if (!list.length) return <section className="card"><h2>Planuri încărcate</h2><p className="hint">Niciun plan încărcat încă din admin.</p></section>;
  return (
    <section className="card">
      <div className="cardHead">
        <h2>Planuri încărcate</h2>
        <div className="actions">
          {retryIds.length > 1 && <button type="button" className="btn btnGhost btnSm" disabled={!!busy} onClick={() => act("toate", "retry", retryIds)}>{busy === "toate" ? "…" : `Reîncearcă toate (${retryIds.length})`}</button>}
          {readyIds.length > 1 && <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => act("toate", "publish", readyIds)}>{busy === "toate" ? "…" : `Publică toate (${readyIds.length})`}</button>}
        </div>
      </div>
      {retryIds.length > 40 && <p className="hint">„Reîncearcă toate” pornește câte 40 o dată: apasă din nou pentru restul.</p>}
      {readyIds.length > 1 && <p className="hint">„Publică toate” le pune în localizator dintr-o dată, cu un singur deploy.</p>}
      {warning && <div role="alert" className="error">{warning}</div>}
      <ul className="docList">
        {list.map((u) => {
          const [label, cls] = STATUS[u.status];
          return (
            <li key={u.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span className="who">
                  <b>{u.uat_name}{u.county ? `, jud. ${u.county}` : ""}{u.new_uat ? " (UAT nou)" : ""}</b>
                  <small>{[u.plan_date && `date la ${roDate(u.plan_date)}`, u.file_name, mb(u.size), u.by_name, new Date(u.created_at).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Bucharest" })].filter(Boolean).join(" · ")}</small>
                </span>
                <span className={`pill ${cls}`}><i />{label}</span>
              </div>
              {u.status === "converting" && <p className="hint">Conversia durează câteva minute. Pagina se actualizează singură.</p>}
              {u.status === "published" && u.published_at && Date.now() - new Date(u.published_at).getTime() < 3 * 3600e3 && <p className="hint">Apare în localizator după deploy (în producție: după ce îl aprobi în GitHub → Actions → Deploy).</p>}
              {u.status === "publishing" && <p className="hint">Se pune în localizator, apoi pornește deploy-ul. În producție deploy-ul așteaptă aprobarea ta în GitHub → Actions → Deploy.</p>}
              {u.summary && <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, background: "var(--cream)", borderRadius: 10, padding: "10px 12px" }}>{u.summary}</pre>}
              {u.error && <div className="error">{u.error}</div>}
              <div className="actions" style={{ justifyContent: "flex-start" }}>
                {(u.status === "ready" || (u.status === "failed" && u.summary)) && (
                  <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => act(u.id, "publish")}>{busy === u.id ? "…" : u.status === "failed" ? "Publică din nou" : "Publică în localizator"}</button>
                )}
                {u.status === "failed" && !u.summary && !!u.asset_id && <button type="button" className="btn btnNavy btnSm" disabled={!!busy} onClick={() => act(u.id, "retry")}>{busy === u.id ? "…" : "Reîncearcă"}</button>}
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
