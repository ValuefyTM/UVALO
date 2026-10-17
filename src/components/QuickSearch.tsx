"use client";

import { useMemo, useRef, useState } from "react";

type Uat = { key: string; name: string; county: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();

// words that may sit next to the UAT / county without making the text an address
const NOISE = new Set(["jud", "judet", "judetul", "uat", "com", "comuna", "loc", "localitatea", "mun", "municipiul", "oras", "orasul", "sat", "satul", "ro", "romania", "nr", "cad", "cf", "topo"]);

/** What the text asks for: an address / coordinates, or a cadastral / topo number with the UAT (and county) it names. */
function read(text: string, uats: Uat[]) {
  const q = text.trim();
  if (!q) return { kind: "empty" as const };
  if (/^-?\d{1,3}[.,]\d+\s*[,; ]\s*-?\d{1,3}[.,]\d+$/.test(q)) return { kind: "address" as const, q };
  // Stereo 70: "X 476000 Y 210500", "476000, 210500" (the locator and the site analysis read both orders)
  if (/^(?:[XYNE]\s*[=:]?\s*)?\d{5,7}(?:[.,]\d{1,4})?\s*[,;/ ]\s*(?:[XYNE]\s*[=:]?\s*)?\d{5,7}(?:[.,]\d{1,4})?$/i.test(q)) return { kind: "stereo" as const, q };
  // a number first ("413830 Giroc", "123/4, Giroc, Timiș"); anything else is an address
  const m = q.match(/^(?:nr\.?\s*|cad\.?\s*|cf\s*)?(\d[\w/.-]*)\s*[,;]?\s*(.*)$/i);
  if (!m) return { kind: "address" as const, q };
  const nr = m[1], place = ` ${norm(m[2])} `;
  if (!place.trim()) return { kind: "number" as const, nr, uat: null, ask: "missing" as const };
  const counties = [...new Set(uats.map((u) => u.county))].filter((c) => place.includes(` ${norm(c)} `));
  // the longest UAT name in the text (so "Becicherecu Mic" wins over a shorter name inside it)
  const hits = uats.filter((u) => place.includes(` ${norm(u.name)} `) && (!counties.length || counties.includes(u.county)));
  const best = Math.max(0, ...hits.map((u) => norm(u.name).length));
  const found = hits.filter((u) => norm(u.name).length === best);
  // other words left besides the UAT / county ("1 Decembrie 1918 nr. 5, Giroc", "1 Mai 15, Lugoj"): it is a street, not a cadastral number
  if (found.length) {
    let rest = place;
    for (const w of [norm(found[0].name), ...counties.map(norm)]) rest = rest.replace(` ${w} `, " ");
    if (rest.split(" ").some((t) => t && !NOISE.has(t))) return { kind: "address" as const, q };
  }
  if (found.length === 1) return { kind: "number" as const, nr, uat: found[0] };
  if (found.length > 1) return { kind: "number" as const, nr, uat: null, ask: "county" as const, options: found };
  return { kind: "number" as const, nr, uat: null, ask: "unknown" as const };
}

type Place = { lat: number; lng: number; estimated: boolean; area: number; uat: { key: string; name: string; county: string | null } | null; inPlan: boolean };
type Doc = { tip_document?: string; nr_cadastral?: string | null; uat?: string | null; judet?: string | null;
  suprafata_masurata_mp?: number | null; suprafata_din_acte_mp?: number | null; _place?: Place | null };

/** Big photos are reduced in the browser (max. 3000 px), as on the site analysis page. */
async function shrink(f: File): Promise<File> {
  if (!/^image\//.test(f.type) || (f.size < 3.5e6 && f.type !== "image/webp")) return f;
  const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
  const k = Math.min(1, 3000 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement("canvas");
  cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
  cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height);
  return new Promise((res) => cv.toBlob((b) => res(new File([b!], "plan.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9));
}
const nf = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 0 });
const EXAMPLES = ["413830 Giroc", "Str. Lavandei 11, Dumbrăvița", "X 476000 Y 210500"];

/**
 * Home search bar of the cadastral locator, on one line: a cadastral or topo number with its locality ("413830 Giroc"),
 * an address, GPS or Stereo 70 coordinates. With the site analysis module, "CF / plan" inside the field (or a file dropped
 * on it) reads a CF extract / site plan with AI (/api/amplasament/plan); the result is one line: what was read, how it was
 * placed (Stereo 70, the locator's plan) and the way on — the site analysis (read data passed on, no re-read) or the map.
 */
/** extra = more buttons on the search row (the new home: "+ Inspecție"); recent = the person's last parcels, shown instead of the examples */
export function QuickSearch({ uats, amp = false, dark = false, extra, recent }: { uats: Uat[]; amp?: boolean; dark?: boolean; extra?: React.ReactNode; recent?: { label: string; href: string }[] }) {
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const r = useMemo(() => read(text, uats), [text, uats]);

  const msg = r.kind !== "number" || r.uat ? "" :
    r.ask === "missing" ? "Scrie și localitatea (UAT-ul), de exemplu „413830 Giroc”." :
    r.ask === "county" ? `„${r.options![0].name}” există în mai multe județe: scrie și județul (${r.options!.map((u) => u.county).join(" sau ")}).` :
    "Nu recunosc localitatea. Scrie UAT-ul așa cum apare în localizator, de exemplu „413830 Giroc, Timiș”.";

  // "Localizează" opens the cadastral locator, "Analiză amplasament" the site analysis (same text, same rules).
  const go = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTried(true);
    const toAmp = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "amp";
    if (r.kind === "empty") return;
    if (r.kind === "address" || r.kind === "stereo") { location.href = toAmp ? `/amplasament?adr=${encodeURIComponent(r.q)}` : `/localizare?adr=${encodeURIComponent(r.q)}`; return; }
    if (r.uat) location.href = toAmp
      ? `/amplasament?uat=${encodeURIComponent(r.uat.key)}&nr=${encodeURIComponent(r.nr)}`
      : `/localizare?uat=${encodeURIComponent(r.uat.key)}&q=${encodeURIComponent(r.nr)}`;
  };

  async function readDoc(f: File) {
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type)) { setErr("Documentul trebuie să fie PDF sau imagine (JPG, PNG)."); return; }
    if (f.size > 15 * 1024 * 1024 && f.type === "application/pdf") { setErr("PDF-ul are peste 15 MB. Trimite doar paginile cu planul."); return; }
    setBusy(true); setErr(""); setDoc(null);
    try {
      const fd = new FormData();
      fd.append("file", await shrink(f));
      const res = await fetch("/api/amplasament/plan", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as Doc & { error?: string };
      if (!res.ok) setErr(j.error || "Documentul nu a putut fi citit.");
      else setDoc(j);
    } catch { setErr("Conexiunea a căzut. Încearcă din nou."); }
    finally { setBusy(false); }
  }
  const drop = amp ? {
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => { if (!e.dataTransfer.files[0]) return; e.preventDefault(); setOver(false); void readDoc(e.dataTransfer.files[0]); },
  } : {};

  const p = doc?._place ?? null;
  const nr = doc?.nr_cadastral?.match(/\d+(?:\/\d+)*/)?.[0] ?? null;
  const toMap = p?.uat ? (p.inPlan && nr ? `/localizare?uat=${encodeURIComponent(p.uat.key)}&q=${encodeURIComponent(nr)}` : `/localizare?adr=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    : p ? `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}` : null;
  const stated = doc?.suprafata_masurata_mp ?? doc?.suprafata_din_acte_mp ?? null;
  const kind = /funciar|extras de carte/i.test(doc?.tip_document ?? "") ? "Extras CF" : /plan/i.test(doc?.tip_document ?? "") ? "Plan" : "Document";
  const toAmp = () => {
    try { sessionStorage.setItem("uvalo-doc", JSON.stringify(doc)); } catch { /* full or blocked: the page asks for the file again */ }
    location.href = "/amplasament?doc=1";
  };

  return (
    <form className={dark ? "quickMain onDark" : "quickMain"} onSubmit={go} noValidate>
      <div className="quickRow">
        <div className={`quickField${over ? " over" : ""}`} {...drop}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="quickQ" name="q" aria-label="Caută un imobil" value={text} onChange={(e) => { setText(e.target.value); setTried(false); }}
            placeholder={over ? "Eliberează ca să citim documentul" : "Nr. cadastral și localitatea, adresă, GPS sau Stereo 70"} autoComplete="off" />
          {amp && (
            <>
              <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readDoc(f); e.target.value = ""; }} />
              <button type="button" className="quickDoc" disabled={busy} onClick={() => file.current?.click()} title="Încarcă un extras CF sau un plan de amplasament: îl citim automat">
                {busy ? <span className="docSpin" aria-hidden="true" /> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 12-8.5 8.5a5 5 0 0 1-7-7L14 5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15.5 8" /></svg>}
                {busy ? "Citesc…" : "CF / plan"}
              </button>
            </>
          )}
        </div>
        <button type="submit" className="quickBtn" value="loc">Localizează</button>
        {amp && <button type="submit" className="quickBtn alt" value="amp">Analiză amplasament</button>}
        {extra}
      </div>

      {busy ? <p className="quickHint">Citesc documentul cu AI: coordonatele Stereo 70, suprafața, numărul cadastral · durează de obicei 20–60 de secunde</p>
        : err ? <p className="quickMsg" role="alert">{err}</p>
        : doc ? (
          <div className="docLine" role="status">
            <span className="docOk" aria-hidden="true">✓</span>
            <span className="docWhat">{kind}{nr && <> <b>{nr}</b></>}{doc.uat && <> · {doc.uat}</>}{doc.judet && <>, {doc.judet}</>}{stated ? <> · {nf(stated)} mp</> : null}</span>
            {p ? <span className="docYes" title={`${p.lat.toFixed(5)} N, ${p.lng.toFixed(5)} E · suprafață calculată ${nf(p.area)} mp`}>✓ Stereo 70{p.estimated ? " (estimat)" : ""}</span> : <span className="docNo">fără coordonate Stereo 70</span>}
            {p?.inPlan ? <span className="docYes">✓ în planul cadastral</span> : <span className="docNo">{p?.uat ? "nu e în planul cadastral" : "fără plan cadastral"}</span>}
            <span className="docGo">
              <button type="button" className="quickBtn sm" onClick={toAmp}>Analiză amplasament</button>
              {toMap && <a className="quickBtn sm alt" href={toMap} {...(p?.uat ? {} : { target: "_blank", rel: "noopener" })}>{p?.uat ? "Hartă" : "Google Maps ↗"}</a>}
              <button type="button" className="docX" aria-label="Închide" onClick={() => setDoc(null)}>×</button>
            </span>
          </div>
        )
        : r.kind === "number" && r.uat ? <p className="quickHint">Nr. <b>{r.nr}</b> în <b>{r.uat.name}</b>, județul {r.uat.county}</p>
        : r.kind === "address" ? <p className="quickHint">Caut adresa sau coordonatele pe hartă</p>
        : r.kind === "stereo" ? <p className="quickHint">Coordonate <b>Stereo 70</b>: le convertesc și le arăt pe hartă</p>
        : msg && (tried || r.ask === "county") ? <p className="quickMsg" role="alert">{msg}</p>
        : r.kind === "empty" && tried ? <p className="quickMsg" role="alert">Scrie un număr cadastral cu localitatea, o adresă sau coordonate.</p>
        : r.kind === "empty" && recent?.length ? (
          <p className="quickEx quickRecent">
            <span>Recente:</span>
            {recent.map((x) => <a key={x.href} href={x.href}>{x.label}</a>)}
          </p>
        )
        : r.kind === "empty" ? (
          <p className="quickEx">
            <span>Exemple:</span>
            {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => { setText(x); document.getElementById("quickQ")?.focus(); }}>{x}</button>)}
            {amp && <span>· sau trage un extras CF / plan de amplasament peste câmp</span>}
          </p>
        ) : null}
    </form>
  );
}
