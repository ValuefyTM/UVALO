"use client";

import { useState } from "react";
import { PROP_TYPES, QKIND_LABEL, qCount, SUBKIND_LABEL, type Group, type QKind, type Question, type SubKind, type Template } from "@/lib/insp-shared";

export type TplItem = { id: string; owner: "uvalo" | "org" | "user"; name: string; prop: string | null; draft: Template; version: number; enforced: boolean; dirty: boolean; editable: boolean };

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(j.error || "Nu a mers.");
  return j as { id?: string };
}
const rid = () => Math.random().toString(36).slice(2, 9);
const OWNER = { org: "Biroul meu · comune", user: "Ale mele", uvalo: "UVALO · implicite" } as const;

/** Fișe de inspecție: the firm's and the person's templates (editable, versioned) and the UVALO ones (read-only, duplicated to change). */
export function InspTemplates({ items, canOrg, start }: { items: TplItem[]; canOrg: boolean; start?: string }) {
  const [sel, setSel] = useState(start && items.some((t) => t.id === start) ? start : items.find((t) => t.editable)?.id ?? items[0]?.id);
  const cur = items.find((t) => t.id === sel)!;
  const [name, setName] = useState(cur?.name ?? "");
  const [prop, setProp] = useState(cur?.prop ?? "");
  const [enforced, setEnforced] = useState(!!cur?.enforced);
  const [tpl, setTpl] = useState<Template>(cur?.draft ?? { groups: [] });
  const [open, setOpen] = useState(0);
  const [q, setQ] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [changed, setChanged] = useState(false);

  const choose = (id: string) => {
    if (changed && !confirm("Ai modificări nesalvate. Le pierzi?")) return;
    const t = items.find((x) => x.id === id)!;
    setSel(id); setName(t.name); setProp(t.prop ?? ""); setEnforced(t.enforced); setTpl(t.draft); setOpen(0); setQ(null); setChanged(false); setMsg("");
  };
  const edit = (f: (t: Template) => Template) => { setTpl((t) => f(structuredClone(t))); setChanged(true); };
  const ro = !cur?.editable;
  async function run(body: Record<string, unknown>, after?: (id?: string) => void) {
    setBusy(true); setMsg("");
    try { const r = await post(body); after ? after(r.id) : location.reload(); } catch (e) { setMsg((e as Error).message); setBusy(false); }
  }
  const save = () => run({ action: "tpl_save", id: sel, name, prop_type: prop, enforced, tpl }, () => { setChanged(false); setBusy(false); setMsg("Ciorna a fost salvată."); });
  const publish = () => run({ action: "tpl_save", id: sel, name, prop_type: prop, enforced, tpl }, () => run({ action: "tpl_publish", id: sel }, () => { location.href = `/inspectii/fise?id=${sel}`; }));
  const dup = (owner: "user" | "org") => run({ action: "tpl_duplicate", id: sel, owner }, (id) => { location.href = `/inspectii/fise?id=${id}`; });

  const qq: Question | null = q ? tpl.groups[q[0]]?.qs[q[1]] ?? null : null;
  const setQq = (f: (x: Question) => void) => q && edit((t) => { f(t.groups[q[0]].qs[q[1]]); return t; });
  const moveG = (i: number, d: number) => edit((t) => { const j = i + d; if (j < 0 || j >= t.groups.length) return t; [t.groups[i], t.groups[j]] = [t.groups[j], t.groups[i]]; return t; });
  const moveQ = (gi: number, i: number, d: number) => edit((t) => { const a = t.groups[gi].qs, j = i + d; if (j < 0 || j >= a.length) return t; [a[i], a[j]] = [a[j], a[i]]; return t; });

  return (
    <div className="inTplPage">
      <aside className="inTplList">
        {(["org", "user", "uvalo"] as const).map((o) => {
          const list = items.filter((t) => t.owner === o);
          if (!list.length && o === "org" && !canOrg) return null;
          return (
            <section key={o}>
              <span className="eyebrow">{OWNER[o]}</span>
              {list.map((t) => (
                <button key={t.id} type="button" aria-pressed={sel === t.id} onClick={() => choose(t.id)}>
                  <b>{t.name}</b><small>{t.owner === "uvalo" ? "doar citire" : t.version ? `v${t.version} publicată${t.dirty ? " · ciornă nouă" : ""}` : "ciornă, nepublicată"}{t.enforced ? " · impusă" : ""}</small>
                </button>
              ))}
              {!list.length && <small className="hint">Nicio fișă încă.</small>}
            </section>
          );
        })}
        <button type="button" className="btn btnGhost btnSm" disabled={busy} onClick={() => run({ action: "tpl_new", owner: "user" }, (id) => { location.href = `/inspectii/fise?id=${id}`; })}>+ Fișă nouă</button>
      </aside>

      {cur && (
        <section className="card inTplEdit">
          <div className="inTplHead">
            {ro ? <h2>{cur.name}</h2> : <input className="input inTplName" value={name} aria-label="Numele fișei" onChange={(e) => { setName(e.target.value); setChanged(true); }} />}
            <span className="inTplTag">{ro ? "UVALO · doar citire" : changed || cur.dirty ? `Ciornă${cur.version ? ` · v${cur.version} publicată` : ""}` : `v${cur.version} publicată`}</span>
          </div>
          <div className="inTplOpts">
            <label className="field">Pentru<select className="select" value={prop} disabled={ro} onChange={(e) => { setProp(e.target.value); setChanged(true); }}>
              <option value="">Orice proprietate</option>{PROP_TYPES.map((p) => <option key={p}>{p}</option>)}</select></label>
            {cur.owner === "org" && <label className="check"><input type="checkbox" checked={enforced} disabled={ro} onChange={(e) => { setEnforced(e.target.checked); setChanged(true); }} /> Impusă colegilor din birou</label>}
          </div>

          {tpl.groups.map((g: Group, gi) => (
            <div key={g.id} className="inGrp">
              <div className="inGrpHead">
                <button type="button" className="inGrpToggle" aria-expanded={open === gi} onClick={() => setOpen(open === gi ? -1 : gi)}>{open === gi ? "▾" : "▸"}</button>
                {ro ? <b>{g.name}</b> : <input className="input inGrpName" value={g.name} aria-label="Numele grupului" onChange={(e) => edit((t) => { t.groups[gi].name = e.target.value; return t; })} />}
                <small>{g.qs.length} întrebări</small>
                {!ro && <span className="inMini">
                  <button type="button" aria-label="Mută grupul în sus" onClick={() => moveG(gi, -1)}>↑</button>
                  <button type="button" aria-label="Mută grupul în jos" onClick={() => moveG(gi, 1)}>↓</button>
                  <button type="button" aria-label="Șterge grupul" onClick={() => confirm(`Ștergi grupul „${g.name}”?`) && edit((t) => { t.groups.splice(gi, 1); return t; })}>×</button>
                </span>}
              </div>
              {open === gi && (
                <div className="inQs">
                  {g.qs.map((x, qi) => (
                    <div key={x.id} className={`inQ${q && q[0] === gi && q[1] === qi ? " on" : ""}`}>
                      <button type="button" className="inQMain" onClick={() => setQ([gi, qi])}><span>{x.t}</span><small>{QKIND_LABEL[x.kind]}{x.req ? " · obligatorie" : ""}</small></button>
                      {!ro && <span className="inMini">
                        <button type="button" aria-label="Mută în sus" onClick={() => moveQ(gi, qi, -1)}>↑</button>
                        <button type="button" aria-label="Mută în jos" onClick={() => moveQ(gi, qi, 1)}>↓</button>
                        <button type="button" aria-label="Șterge întrebarea" onClick={() => { edit((t) => { t.groups[gi].qs.splice(qi, 1); return t; }); setQ(null); }}>×</button>
                      </span>}
                    </div>
                  ))}
                  {!ro && <span className="inQAdd">
                    <button type="button" className="btn btnGhost btnSm" onClick={() => { edit((t) => { t.groups[gi].qs.push({ id: `q${rid()}`, t: "Întrebare nouă", kind: "one", options: ["Da", "Nu"], req: true, pdf: true }); return t; }); setQ([gi, g.qs.length]); }}>+ Întrebare</button>
                    <button type="button" className="btn btnGhost btnSm" title="O alegere care, după răspuns, mai pune câteva întrebări (ca la branșamente)" onClick={() => { edit((t) => { t.groups[gi].qs.push({ id: `q${rid()}`, t: "Întrebare compusă", kind: "comp", options: ["Da", "Nu"], sub: {}, req: false, pdf: true }); return t; }); setQ([gi, g.qs.length]); }}>+ Întrebare compusă</button>
                  </span>}
                </div>
              )}
            </div>
          ))}
          {!ro && <button type="button" className="btn btnGhost btnSm" onClick={() => { edit((t) => { t.groups.push({ id: `g${rid()}`, name: "Grup nou", qs: [] }); return t; }); setOpen(tpl.groups.length); }}>+ Grup</button>}

          {msg && <p className="note" role="status">{msg}</p>}
          <div className="actions">
            {ro ? <>
              <button type="button" className="btn btnGold" disabled={busy} onClick={() => dup("user")}>Duplică în fișele mele</button>
              {canOrg && <button type="button" className="btn btnGhost" disabled={busy} onClick={() => dup("org")}>Duplică pentru birou</button>}
            </> : <>
              <button type="button" className="btn btnGold" disabled={busy} onClick={publish}>Publică versiunea {cur.version + 1}</button>
              <button type="button" className="btn btnGhost" disabled={busy || !changed} onClick={save}>Salvează ciorna</button>
              <button type="button" className="btn btnGhost" disabled={busy} onClick={() => dup("user")}>Duplică</button>
              <button type="button" className="btn btnDanger" disabled={busy} onClick={() => confirm("Ștergi fișa? Inspecțiile făcute cu ea o păstrează.") && run({ action: "tpl_delete", id: sel }, () => { location.href = "/inspectii/fise"; })}>Șterge</button>
            </>}
          </div>
          <p className="hint">{qCount(tpl)} întrebări. Inspecțiile deja făcute păstrează versiunea fișei cu care au fost completate; schimbările intră de la versiunea publicată.</p>
        </section>
      )}

      <aside className="card inQEdit">
        <span className="eyebrow">Întrebarea selectată</span>
        {!qq ? <p className="hint">Alege o întrebare din fișă.</p> : (
          <>
            <label className="field">Întrebarea<input className="input" value={qq.t} disabled={ro} onChange={(e) => setQq((x) => { x.t = e.target.value; })} /></label>
            <label className="field">Tipul răspunsului<select className="select" value={qq.kind} disabled={ro} onChange={(e) => setQq((x) => { x.kind = e.target.value as QKind; if ((x.kind === "one" || x.kind === "many" || x.kind === "comp") && !x.options?.length) x.options = ["Da", "Nu"]; if (x.kind === "comp") x.sub ??= {}; })}>
              {(Object.keys(QKIND_LABEL) as QKind[]).map((k) => <option key={k} value={k}>{QKIND_LABEL[k]}</option>)}</select></label>
            {(qq.kind === "one" || qq.kind === "many" || qq.kind === "comp") && (
              <div className="inOpts">
                <span className="field">Răspunsuri precompletate <small>bifa = răspunsul implicit</small></span>
                {(qq.options ?? []).map((o, i) => (
                  <div key={i} className="inOpt">
                    <input type="radio" name="def" aria-label="Implicit" checked={qq.def === o} disabled={ro} onChange={() => setQq((x) => { x.def = o; })} />
                    <input className="input" value={o} disabled={ro} aria-label="Răspuns" onChange={(e) => setQq((x) => {
                      const nv = e.target.value;
                      if (x.def === o) x.def = nv;
                      if (x.sub?.[o] && !x.sub[nv]) { x.sub[nv] = x.sub[o]; delete x.sub[o]; } // follow-ups move with the renamed answer
                      x.options![i] = nv;
                    })} />
                    {!ro && <button type="button" className="btn btnGhost btnSm" aria-label="Scoate" onClick={() => setQq((x) => { x.options!.splice(i, 1); if (x.def === o) delete x.def; if (x.sub) delete x.sub[o]; })}>×</button>}
                  </div>
                ))}
                {!ro && <button type="button" className="btn btnGhost btnSm" onClick={() => setQq((x) => { x.options = [...(x.options ?? []), ""]; })}>+ Răspuns</button>}
              </div>
            )}
            {qq.kind === "comp" && (qq.options ?? []).filter(Boolean).map((o) => (
              <div key={o} className="inSubEd">
                <span className="field">Dacă răspunsul e „{o}”, întreabă și:</span>
                {(qq.sub?.[o] ?? []).map((sq, si) => (
                  <div key={si} className="inSubQ">
                    <span className="inSubRow">
                      <input className="input" value={sq.t} disabled={ro} placeholder="ex. Apometru montat" aria-label="Întrebarea" onChange={(e) => setQq((x) => { x.sub![o][si].t = e.target.value; })} />
                      {!ro && <button type="button" className="btn btnGhost btnSm" aria-label="Scoate întrebarea" onClick={() => setQq((x) => { x.sub![o].splice(si, 1); })}>×</button>}
                    </span>
                    <span className="inSubRow">
                      <select className="select" value={sq.kind} disabled={ro} aria-label="Tipul răspunsului" onChange={(e) => setQq((x) => { const y = x.sub![o][si]; y.kind = e.target.value as SubKind; if ((y.kind === "one" || y.kind === "many") && !y.options?.length) y.options = ["Da", "Nu"]; })}>
                        {(Object.keys(SUBKIND_LABEL) as SubKind[]).map((k) => <option key={k} value={k}>{SUBKIND_LABEL[k]}</option>)}</select>
                      {(sq.kind === "one" || sq.kind === "many") && <input className="input" value={(sq.options ?? []).join(", ")} disabled={ro} placeholder="Răspunsuri, despărțite prin virgulă" aria-label="Răspunsurile"
                        onChange={(e) => setQq((x) => { x.sub![o][si].options = e.target.value.split(",").map((t) => t.replace(/^\s+/, "")); })} />}
                      {sq.kind === "number" && <input className="input" value={sq.unit ?? ""} disabled={ro} placeholder="Unitatea (ex. ml)" aria-label="Unitatea" onChange={(e) => setQq((x) => { x.sub![o][si].unit = e.target.value; })} />}
                    </span>
                  </div>
                ))}
                {!ro && <button type="button" className="btn btnGhost btnSm" onClick={() => setQq((x) => { x.sub = { ...(x.sub ?? {}) }; (x.sub[o] ??= []).push({ id: `s${rid()}`, t: "", kind: "one", options: ["Da", "Nu"] }); })}>+ Întrebare după „{o}”</button>}
              </div>
            ))}
            {qq.kind === "number" && <label className="field">Unitatea<input className="input" value={qq.unit ?? ""} disabled={ro} placeholder="ex. m, mp, buc." onChange={(e) => setQq((x) => { x.unit = e.target.value; })} /></label>}
            <label className="check"><input type="checkbox" checked={!!qq.req} disabled={ro} onChange={(e) => setQq((x) => { x.req = e.target.checked; })} /> Obligatorie</label>
            <label className="check"><input type="checkbox" checked={qq.pdf !== false} disabled={ro} onChange={(e) => setQq((x) => { x.pdf = e.target.checked; })} /> Apare în PDF</label>
            <label className="check"><input type="checkbox" checked={!!qq.photo} disabled={ro} onChange={(e) => setQq((x) => { x.photo = e.target.checked; })} /> Cere și o fotografie</label>
          </>
        )}
      </aside>
    </div>
  );
}
