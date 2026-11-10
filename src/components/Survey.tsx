"use client";

// The feedback questionnaire (5 steps), mandatory, shown once: as a window over the platform (AppShell) and as a full screen in
// the phone app (MobileApp). Every "Continuă" saves the step (POST /api/survey), so a closed page resumes where it was.
import { useEffect, useRef, useState } from "react";
import type { SurveyState } from "@/lib/survey-shared";
import { SURVEY_LABELS, SURVEY_STEPS } from "@/lib/survey-shared";
import { Referral } from "./Referral";

type A = Record<string, unknown>;
const L = SURVEY_LABELS;

export function Survey({ survey, full, onDone }: { survey: SurveyState; full?: boolean; onDone: () => void }) {
  // step 0 = the intro; 1–5 the questions; 6 = thanks
  const [step, setStep] = useState(survey.step >= SURVEY_STEPS ? SURVEY_STEPS : survey.step > 0 ? survey.step + 1 : 0);
  const [a, setA] = useState<A>(() => {
    const t = { ...((survey.answers.tools as A) ?? {}) };
    for (const x of survey.tools) if (!(x.key in t) && x.n === 0) t[x.key] = "none";
    return { phone: survey.phone, call: "yes", ...survey.answers, tools: t };
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo(0, 0); window.scrollTo(0, 0); }, [step]);
  const set = (k: string, v: unknown) => setA((p) => ({ ...p, [k]: v }));
  const pick = (k: string, v: string) => <button type="button" className={`svChip${a[k] === v ? " on" : ""}`} onClick={() => set(k, v)} aria-pressed={a[k] === v}>{(L as Record<string, Record<string, string>>)[k === "problems" ? "problems" : k][v]}</button>;

  const next = async () => {
    if (step === 0) return setStep(1);
    if (step === 1 && typeof a.nps !== "number") return setErr("Alege o notă de la 0 la 10.");
    setBusy(true); setErr("");
    const r = await fetch("/api/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, answers: a }) })
      .then((x) => x.json().then((v: unknown) => ({ ok: x.ok, j: v as { error?: string; done?: boolean } }))).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr(r?.j.error || "Nu am putut salva. Verifică conexiunea și încearcă din nou.");
    setStep(step + 1);
  };
  const toggleArr = (k: string, v: unknown, max = 99) => {
    const cur = Array.isArray(a[k]) ? [...(a[k] as unknown[])] : [];
    const i = cur.indexOf(v);
    if (i >= 0) cur.splice(i, 1); else if (cur.length < max) cur.push(v);
    set(k, cur);
  };
  const tools = (a.tools ?? {}) as A;
  const low = survey.tools.filter((t) => typeof tools[t.key] === "number" && (tools[t.key] as number) < 3).map((t) => t.label);
  const wants = Array.isArray(a.wants) ? (a.wants as number[]) : [];

  const Prog = () => (
    <div className="svProg"><div className="svDots">{Array.from({ length: SURVEY_STEPS }, (_, i) => <i key={i} className={i < step ? "on" : ""} />)}</div><small>Pasul {step} din {SURVEY_STEPS}</small></div>
  );
  const Foot = ({ note, label = "Continuă" }: { note?: string; label?: string }) => (
    <div className="svFoot">
      <small>{err ? <b className="svErr" role="alert">{err}</b> : note}</small>
      {step > 1 && <button type="button" className="btn btnGhost" onClick={() => { setErr(""); setStep(step - 1); }} disabled={busy}>Înapoi</button>}
      <button type="button" className={`btn ${step === SURVEY_STEPS ? "btnPri" : "btnNavy"}`} onClick={next} disabled={busy}>{busy ? "Se salvează…" : label}</button>
    </div>
  );

  const body = step === 0 ? (
    <>
      <span className="svEye">2 minute · 5 pași · o singură dată</span>
      <h2>{survey.name ? `${survey.name}, spune-ne` : "Spune-ne"} cum merge UVALO pentru tine</h2>
      <p>Folosești platforma de ceva vreme, deci părerea ta contează mai mult decât a oricui. Răspunsurile ajung direct la echipa UVALO și decid ce construim în lunile următoare.</p>
      <ol className="svSteps">
        <li>Cât de probabil e să ne recomanzi unui coleg</li><li>Ce instrumente folosești și ce notă le dai</li><li>Ce ți-ar fi cel mai util în continuare</li>
        <li>Probleme întâmpinate, cât de des folosești UVALO</li><li>Cât ar merita și dacă putem vorbi 15 minute</li>
      </ol>
      <div className="svFoot"><button type="button" className="btn btnPri" onClick={next}>Începe</button><small>Chestionarul apare o singură dată și e obligatoriu pentru a continua. Răspunsurile nu sunt vizibile colegilor sau biroului tău.</small></div>
    </>
  ) : step === 1 ? (
    <>
      <Prog />
      <h2>Cât de probabil e să recomanzi UVALO unui coleg evaluator?</h2>
      <div className="svNps" role="group" aria-label="Nota de la 0 la 10">{Array.from({ length: 11 }, (_, i) => <button key={i} type="button" className={a.nps === i ? "on" : ""} aria-pressed={a.nps === i} onClick={() => { set("nps", i); setErr(""); }}>{i}</button>)}</div>
      <div className="svLg"><span>Deloc probabil</span><span>Foarte probabil</span></div>
      <label className="svLabel">Ce te-a făcut să dai nota asta? <small>· opțional, dar cel mai util răspuns pentru noi</small>
        <textarea className="textarea" rows={3} maxLength={2000} value={String(a.why ?? "")} onChange={(e) => set("why", e.target.value)} placeholder="ex. localizatorul îmi scutește drumuri la OCPI, dar la Word aș vrea…" /></label>
      <Foot note="Nota și motivul ajung doar la echipa UVALO." />
    </>
  ) : step === 2 ? (
    <>
      <Prog />
      <h2>Ce instrumente folosești și ce notă le dai?</h2>
      <p className="svHint">Instrumentele pe care nu le-ai folosit sunt bifate din activitatea ta; corectează dacă e cazul.</p>
      <div className="svTools">
        <div className="svToolH"><span>Instrument</span><span></span><span>Nota · 1 slab, 5 excelent</span></div>
        {survey.tools.map((t) => (
          <div className="svTool" key={t.key}>
            <span className="svToolN"><b>{t.label}</b>{t.n > 0 && <small>{t.n} {t.n === 1 ? "acțiune" : "acțiuni"}{t.last ? ` · ultima ${new Date(t.last).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}` : ""}</small>}</span>
            <span><button type="button" className={`svNo${tools[t.key] === "none" ? " on" : ""}`} aria-pressed={tools[t.key] === "none"} onClick={() => set("tools", { ...tools, [t.key]: tools[t.key] === "none" ? undefined : "none" })}>Nu l-am folosit</button></span>
            <span className="svStars" role="group" aria-label={`Nota pentru ${t.label}`}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={typeof tools[t.key] === "number" && (tools[t.key] as number) >= n ? "on" : ""} aria-label={`${n} din 5`} aria-pressed={tools[t.key] === n} onClick={() => set("tools", { ...tools, [t.key]: n })}>★</button>)}</span>
          </div>
        ))}
      </div>
      <Foot note="Nota sub 3 deschide, la pasul 4, întrebarea „ce anume nu merge”." />
    </>
  ) : step === 3 ? (
    <>
      <Prog />
      <h2>Ce ți-ar fi cel mai util în continuare?</h2>
      <p className="svHint">Alege cel mult 3. Ordinea în care le bifezi contează: prima e cea mai importantă.</p>
      <div className="svOpts">
        {survey.wants.map((w, i) => { const pos = wants.indexOf(i); const [t, d] = w.split(" · "); return (
          <button key={i} type="button" className={`svOpt${pos >= 0 ? " on" : ""}`} aria-pressed={pos >= 0} onClick={() => toggleArr("wants", i, 3)}>
            <i>{pos >= 0 ? pos + 1 : ""}</i><span><b>{t}</b>{d && <small>{d}</small>}</span>
          </button>); })}
        <label className="svOpt svOptWide"><i /><span style={{ flex: "none" }}>Altceva:</span><input className="input" value={String(a.wants_other ?? "")} maxLength={300} onChange={(e) => set("wants_other", e.target.value)} placeholder="ce anume ți-ar ușura munca?" /></label>
      </div>
      <Foot />
    </>
  ) : step === 4 ? (
    <>
      <Prog />
      <h2>Probleme și obiceiuri</h2>
      <div className="svQ"><span className="svLabel">Ai întâmpinat probleme în UVALO?</span><div className="svChips">{Object.keys(L.problems).map((k) => <span key={k}>{pick("problems", k)}</span>)}</div></div>
      <label className="svLabel">Ce anume? {low.length > 0 && <small>· ai dat sub 3 stele la {low.join(", ")}, spune-ne și de ce</small>}
        <textarea className="textarea" rows={2} maxLength={2000} value={String(a.problems_text ?? "")} onChange={(e) => set("problems_text", e.target.value)} placeholder="ex. la anexa foto pozele mari se încarcă greu; pe telefon GPS-ul a luat poziția greșit o dată" /></label>
      <div className="svTwo">
        <div className="svQ"><span className="svLabel">Cât de des folosești UVALO?</span><div className="svChips">{Object.keys(L.freq).map((k) => <span key={k}>{pick("freq", k)}</span>)}</div></div>
        <div className="svQ"><span className="svLabel">De pe ce lucrezi mai ales?</span><div className="svChips">{Object.keys(L.device).map((k) => <span key={k}>{pick("device", k)}</span>)}</div></div>
      </div>
      <div className="svQ"><span className="svLabel">Ce te-a făcut să te întorci în UVALO? <small>· un singur răspuns</small></span><div className="svChips">{Object.keys(L.back).map((k) => <span key={k}>{pick("back", k)}</span>)}</div></div>
      <Foot note="Problemele descrise aici ajung la echipa UVALO ca o sesizare obișnuită." />
    </>
  ) : step === 5 ? (
    <>
      <Prog />
      <h2>Cât ar merita UVALO și putem vorbi?</h2>
      <div className="svQ"><span className="svLabel">Cât ai fi dispus să plătești pe lună pentru UVALO, așa cum e acum? <small>· pe evaluator</small></span><div className="svChips">{Object.keys(L.price).map((k) => <span key={k}>{pick("price", k)}</span>)}</div></div>
      <div className="svQ"><span className="svLabel">Ce model de plată ți se pare corect?</span>
        <div className="svCards">
          {([["user", "o sumă fixă pe lună, toate instrumentele"], ["office", "o sumă pentru toată firma, cu N utilizatori"], ["credits", "plătești doar ce folosești: analize, inspecții, citiri AI"]] as const).map(([k, d]) => (
            <button key={k} type="button" className={`svCard${a.model === k ? " on" : ""}`} aria-pressed={a.model === k} onClick={() => set("model", k)}><b>{L.model[k]}</b><small>{d}</small></button>))}
        </div>
      </div>
      <div className="svQ"><span className="svLabel">Pentru ce ai plăti separat, dacă ar fi opțional?</span><div className="svChips">{Object.keys(L.extra).map((k) => <button key={k} type="button" className={`svChip${Array.isArray(a.extra) && (a.extra as string[]).includes(k) ? " on" : ""}`} aria-pressed={Array.isArray(a.extra) && (a.extra as string[]).includes(k)} onClick={() => toggleArr("extra", k)}>{L.extra[k as keyof typeof L.extra]}</button>)}</div></div>
      <div className="svCall">
        <div><b>Putem vorbi 15 minute despre cum lucrezi?</b><small>Te sunăm noi, când îți convine. Ne ajută enorm.</small></div>
        <div className="svChips"><button type="button" className={`svChip${a.call === "yes" ? " on" : ""}`} aria-pressed={a.call === "yes"} onClick={() => set("call", "yes")}>Da</button><button type="button" className={`svChip${a.call === "no" ? " on" : ""}`} aria-pressed={a.call === "no"} onClick={() => set("call", "no")}>Nu acum</button></div>
        {a.call === "yes" && <input className="input" value={String(a.phone ?? "")} maxLength={40} onChange={(e) => set("phone", e.target.value)} placeholder="Telefon" aria-label="Telefon" />}
      </div>
      <Foot note="Răspunsurile despre preț nu schimbă nimic la contul tău." label="Trimite răspunsurile" />
    </>
  ) : (
    <div className="svDone">
      <span className="svOk" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#157F55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
      <h2>Mulțumim{survey.name ? `, ${survey.name}` : ""}!</h2>
      <p>Răspunsurile tale au ajuns la echipa UVALO.{a.call === "yes" ? " Te sunăm în zilele următoare, cum ai cerut." : ""} Ce construim ca urmare a chestionarului apare în noutățile de pe Acasă.</p>
      <div className="svRef"><div><b>Cunoști un coleg care ar folosi UVALO?</b><small>Îi trimiți o invitație și intră direct, cu cont gata făcut.</small></div><Referral variant="button" label="Recomandă un coleg" /></div>
      <button type="button" className="btn btnNavy" onClick={onDone}>{full ? "Mergi la inspecții" : "Mergi la Acasă"}</button>
    </div>
  );

  return full ? <div className="svFull" ref={box}><div className="svBox svBoxFull" role="dialog" aria-modal="true" aria-label="Chestionar UVALO">{body}</div></div>
    : <div className="svBg"><div className="svBox" role="dialog" aria-modal="true" aria-label="Chestionar UVALO" ref={box}>{body}</div></div>;
}

/** On the platform: the questionnaire over the page, until it is completed (then the page shows as usual). */
export function SurveyModal({ survey }: { survey: SurveyState }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { document.documentElement.style.overflow = open ? "hidden" : ""; return () => { document.documentElement.style.overflow = ""; }; }, [open]);
  return open ? <Survey survey={survey} onDone={() => setOpen(false)} /> : null;
}
