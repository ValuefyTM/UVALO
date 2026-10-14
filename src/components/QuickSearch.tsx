"use client";

import { useMemo, useState } from "react";

type Uat = { key: string; name: string; county: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();

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
  if (found.length === 1) return { kind: "number" as const, nr, uat: found[0] };
  if (found.length > 1) return { kind: "number" as const, nr, uat: null, ask: "county" as const, options: found };
  return { kind: "number" as const, nr, uat: null, ask: "unknown" as const };
}

/**
 * Home search bar of the cadastral locator: one text field. A cadastral or topo number goes with its locality
 * ("413830 Giroc", "413830, Giroc, Timiș"): the bar finds the UAT and county in the text and says so; without them it
 * asks for them. An address or coordinates go to the locator's address search.
 */
export function QuickSearch({ uats, amp = false, dark = false }: { uats: Uat[]; amp?: boolean; dark?: boolean }) {
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
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

  return (
    <div className={amp ? "quickWrap withDoc" : "quickWrap"}>
      <form className={dark ? "quickMain onDark" : "quickMain"} onSubmit={go} noValidate>
        <label className="quickLbl" htmlFor="quickQ">Caută un imobil</label>
        <div className="quickRow">
          <input id="quickQ" className="quickInput" name="q" value={text} onChange={(e) => { setText(e.target.value); setTried(false); }}
            placeholder="Nr. cadastral și localitatea (413830 Giroc), adresă, GPS sau Stereo 70" autoComplete="off" />
          <button type="submit" className="quickBtn" value="loc">Localizează</button>
          {amp && <button type="submit" className="quickBtn alt" value="amp">Analiză amplasament</button>}
        </div>
        {r.kind === "number" && r.uat && <p className="quickHint">Nr. <b>{r.nr}</b> în <b>{r.uat.name}</b>, județul {r.uat.county}</p>}
        {r.kind === "address" && <p className="quickHint">Caut adresa sau coordonatele pe hartă</p>}
        {r.kind === "stereo" && <p className="quickHint">Coordonate <b>Stereo 70</b>: le convertesc și le arăt pe hartă</p>}
        {msg && (tried || r.ask === "county") && <p className="quickMsg" role="alert">{msg}</p>}
        {r.kind === "empty" && tried && <p className="quickMsg" role="alert">Scrie un număr cadastral cu localitatea, o adresă sau coordonate.</p>}
        {r.kind === "empty" && !tried && (
          <p className="quickHint">
            Caută după <b>nr. cadastral</b>, <b>adresă</b>, <b>GPS</b> sau <b>Stereo 70</b> (X 476000 Y 210500){amp && <> · sau trage <b>extrasul CF</b> ori <b>planul de amplasament</b> în caseta „CF sau plan”: îl citim automat</>}.
          </p>
        )}
      </form>
      {amp && <DocDrop />}
    </div>
  );
}

type Place = { lat: number; lng: number; estimated: boolean; area: number; uat: { key: string; name: string; county: string | null } | null; inPlan: boolean };
type Doc = { tip_document?: string; nr_cadastral?: string | null; nr_carte_funciara?: string | null; uat?: string | null; judet?: string | null;
  suprafata_masurata_mp?: number | null; suprafata_din_acte_mp?: number | null; puncte?: unknown[]; puncte_estimate?: unknown[]; _place?: Place | null };

/** Big photos are reduced in the browser (max. 3000 px), as on the site analysis page. */
async function shrink(f: File): Promise<File> {
  if (!/^image\//.test(f.type) || (f.size < 3.5e6 && f.type !== "image/webp")) return f;
  const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
  const k = Math.min(1, 3000 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement("canvas");
  cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
  cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height);
  return new Promise((res) => cv.toBlob((b) => res(new File([b!], "plan.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9));
}

const nf = (n: number, d = 0) => n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Square drop zone next to the home search: a CF extract or a site plan is read with AI (/api/amplasament/plan), then
 * the card says what was read and how the property was identified — in the locator's cadastral plan (its number) and/or
 * by its Stereo 70 coordinates — and offers the cadastral map or the site analysis (which gets the read data, no re-read).
 */
function DocDrop() {
  const [st, setSt] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [doc, setDoc] = useState<Doc | null>(null);

  async function read(f: File) {
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type)) { setSt("err"); setErr("Documentul trebuie să fie PDF sau imagine (JPG, PNG)."); return; }
    if (f.size > 15 * 1024 * 1024 && f.type === "application/pdf") { setSt("err"); setErr("PDF-ul are peste 15 MB. Trimite doar paginile cu planul."); return; }
    setSt("busy"); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", await shrink(f));
      const r = await fetch("/api/amplasament/plan", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as Doc & { error?: string };
      if (!r.ok) { setSt("err"); setErr(j.error || "Documentul nu a putut fi citit."); return; }
      setDoc(j); setSt("done");
    } catch { setSt("err"); setErr("Conexiunea a căzut. Încearcă din nou."); }
  }

  const pick = (f?: File | null) => { if (f) void read(f); };
  const toAmp = () => {
    try { sessionStorage.setItem("uvalo-doc", JSON.stringify(doc)); } catch { /* full or blocked: the page asks for the file again */ }
    location.href = "/amplasament?doc=1";
  };
  const p = doc?._place ?? null;
  const nr = doc?.nr_cadastral?.match(/\d+/)?.[0] ?? null;
  const toMap = p?.uat ? (p.inPlan && nr ? `/localizare?uat=${encodeURIComponent(p.uat.key)}&q=${encodeURIComponent(nr)}` : `/localizare?adr=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`) : null;
  const stated = doc?.suprafata_masurata_mp ?? doc?.suprafata_din_acte_mp ?? null;
  const kind = /funciar|extras de carte/i.test(doc?.tip_document ?? "") ? "Extrasul CF" : /plan/i.test(doc?.tip_document ?? "") ? "Planul" : "Documentul";

  return (
    <>
      <label className={`docDrop${over ? " over" : ""}${st === "busy" ? " busy" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={st === "busy"}
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        {st === "busy" ? (
          <><span className="docSpin" aria-hidden="true" /><b>Citesc…</b><small>20–60 s</small></>
        ) : (
          <>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 17v-6" /><path d="m9.5 13.5 2.5-2.5 2.5 2.5" /></svg>
            <b>CF sau plan</b><small>trage aici sau alege</small>
          </>
        )}
      </label>
      {(st === "done" || st === "err") && (
        <div className={`docCard${st === "err" ? " bad" : ""}`} role="status">
          <button type="button" className="docX" aria-label="Închide" onClick={() => { setSt("idle"); setDoc(null); }}>×</button>
          {st === "err" ? <p className="docErr">{err}</p> : doc && (
            <>
              <p className="docHead"><span className="docOk">✓</span> {kind} a fost citit
                {nr && <> · nr. cad. <b>{doc.nr_cadastral}</b></>}{doc.uat && <> · {doc.uat}</>}{doc.judet && <>, jud. {doc.judet}</>}
                {stated ? <> · {nf(stated)} mp</> : null}</p>
              <ul className="docChecks">
                <li className={p?.inPlan ? "ok" : "no"}>
                  {p?.inPlan ? <>Identificat în <b>planul cadastral</b> din localizator: nr. {nr}, {p.uat!.name}</>
                    : p?.uat ? <>Numărul {nr ?? "cadastral"} nu apare în planul {p.uat.name} din localizator</>
                    : <>Localitatea nu are încă plan cadastral în localizator</>}
                </li>
                <li className={p ? "ok" : "no"}>
                  {p ? <>Localizat după <b>coordonatele Stereo 70</b>{p.estimated && " (estimate din caroiaj)"}: {nf(p.lat, 5)} N, {nf(p.lng, 5)} E · suprafață calculată {nf(p.area)} mp{stated ? ` (pe document ${nf(stated)} mp)` : ""}</>
                    : <>Documentul nu are coordonate Stereo 70 lizibile</>}
                </li>
              </ul>
              <div className="docGo">
                {toMap && <a className="quickBtn" href={toMap}>Vezi pe harta cadastrală</a>}
                <button type="button" className={toMap ? "quickBtn alt" : "quickBtn"} onClick={toAmp}>Analiză amplasament</button>
                {!toMap && p && <a className="docMap" href={`https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`} target="_blank" rel="noopener">Vezi punctul pe Google Maps ↗</a>}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
