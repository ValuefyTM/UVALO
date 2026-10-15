"use client";

import { useState } from "react";
import { UserAv } from "./UserAv";
import { ASSIGN_LABEL, CONTACT_ROLES, PROP_TYPES, qCount, type AssignKind, type Template } from "@/lib/insp-shared";

export type FormTpl = { id: string; name: string; owner: string; version: number; prop: string | null; enforced: boolean; tpl: Template };
export type FormInit = {
  id?: string; address: string; cad_nr: string; cf_nr: string; uat: string; county: string; lat: number | null; lng: number | null; prop_type: string;
  area_util: string; area_land: string; rooms: { n: string; a: string }[]; template_id: string; contact_name: string; contact_phone: string; contact_role: string;
  date: string; time: string; duration_min: number; assignee_kind: AssignKind; assignee_id: string; notes: string;
};

/** Inspecție nouă / editare: the property (with a CF read automatically), the template, contact and schedule, who does it. */
export type TeamPerson = { id: string; name: string; group: "membru" | "angajat" | "colaborator"; legit: string | null; av?: boolean; busy: { id: string; at: string; min: number }[] };
const GROUPS: [TeamPerson["group"], string][] = [["membru", "Evaluatori din birou"], ["angajat", "Angajați asociați"], ["colaborator", "Colaboratori asociați"]];
const hm = (at: string) => at.slice(11, 16);
const addMin = (at: string, m: number) => { const [h, mi] = hm(at).split(":").map(Number); const t = h * 60 + mi + m; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
const toMin = (x: string) => { const [h, m] = x.split(":").map(Number); return h * 60 + m; };

/** "Cine o face" → din birou: the office's people grouped (evaluators, angajați, colaboratori), with the availability on the chosen day. */
function TeamPick({ team, value, onPick, date, time, dur, selfId }: { team: TeamPerson[]; value: string; onPick: (id: string) => void; date: string; time: string; dur: number; selfId?: string }) {
  const [q, setQ] = useState("");
  const shown = team.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const day = (p: TeamPerson) => p.busy.filter((b) => b.id !== selfId && b.at.slice(0, 10) === date);
  const clash = (p: TeamPerson) => !!date && !!time && day(p).some((b) => toMin(hm(b.at)) < toMin(time) + dur && toMin(time) < toMin(hm(b.at)) + b.min);
  const next = (p: TeamPerson) => p.busy.find((b) => b.id !== selfId && b.at.slice(0, 16) >= new Date().toISOString().slice(0, 16));
  return (
    <div className="tpBox">
      {team.length > 6 && <input className="input tpSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută după nume…" aria-label="Caută în birou" />}
      {GROUPS.map(([g, label]) => {
        const list = shown.filter((p) => p.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className={`tpGroup tp-${g}`} role="radiogroup" aria-label={label}>
            <h4><i aria-hidden="true" />{label} <span>{list.length}</span></h4>
            {list.map((p) => {
              const d = day(p), bad = clash(p), nx = next(p);
              return (
                <button key={p.id} type="button" role="radio" aria-checked={value === p.id} className={`tpRow${value === p.id ? " on" : ""}`} onClick={() => onPick(p.id)}>
                  <i className="tpRadio" aria-hidden="true" /><UserAv id={p.id} name={p.name} has={p.av} size={32} />
                  <span className="tpName"><b>{p.name}</b><small>{p.legit ? `leg. ANEVAR ${p.legit}` : ""}</small></span>
                  <span className={`tpAvail${bad ? " bad" : date && !d.length ? " free" : ""}`}>
                    {date
                      ? bad ? `ocupat atunci · ${d.map((b) => `${hm(b.at)}–${addMin(b.at, b.min)}`).join(", ")}`
                        : d.length ? `${d.length === 1 ? "o inspecție" : `${d.length} inspecții`} în ziua aleasă · ${d.map((b) => `${hm(b.at)}–${addMin(b.at, b.min)}`).join(", ")}` : "liber în ziua aleasă"
                      : nx ? `următoarea: ${nx.at.slice(8, 10)}.${nx.at.slice(5, 7)}, ${hm(nx.at)}` : "nicio inspecție programată"}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
      {!shown.length && <p className="hint" style={{ margin: 0 }}>Nimeni cu acest nume.</p>}
    </div>
  );
}

export function InspForm({ init, tpls, team, canRead, ops }: { init: FormInit; tpls: FormTpl[]; team: TeamPerson[]; canRead: boolean; ops?: boolean }) {
  const [v, setV] = useState(init);
  const [later, setLater] = useState(!init.date);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState("");
  const [read, setRead] = useState<string[]>([]);
  const [files, setFiles] = useState<{ f: File; kind: "cf" | "releveu" | "doc" }[]>([]);
  const set = <K extends keyof FormInit>(k: K, x: FormInit[K]) => setV((o) => ({ ...o, [k]: x }));

  async function readDoc(f: File) {
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type)) { setMsg("Documentul trebuie să fie PDF sau imagine."); return; }
    setReading(true); setMsg("");
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/amplasament/plan", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) throw new Error(j.error || "Documentul nu a putut fi citit.");
      const area = j.suprafata_masurata_mp ?? j.suprafata_din_acte_mp;
      const isCF = /funciar|extras de carte/i.test(j.tip_document || "");
      setV((o) => ({
        ...o,
        address: j.adresa || o.address || [j.uat, j.judet && `jud. ${j.judet}`].filter(Boolean).join(", "),
        cad_nr: j.nr_cadastral || o.cad_nr, cf_nr: j.nr_carte_funciara || o.cf_nr, uat: j.uat || o.uat, county: j.judet || o.county,
        area_land: area ? String(area).replace(".", ",") : o.area_land, lat: j._place?.lat ?? o.lat, lng: j._place?.lng ?? o.lng,
      }));
      setFiles((x) => [...x, { f, kind: isCF ? "cf" : "doc" }]);
      setRead((x) => [...new Set([...x, isCF ? `Extras CF${j.nr_cadastral ? ` ${j.nr_cadastral}` : ""}` : `Plan${j.nr_cadastral ? ` ${j.nr_cadastral}` : ""}`])]);
    } catch (e) { setMsg((e as Error).message); } finally { setReading(false); }
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "save", ...v, rooms: v.rooms.filter((x) => x.n.trim()), scheduled_at: later || !v.date ? "" : `${v.date}T${v.time || "10:00"}`, from_doc: read.length > 0,
      }) });
      const j = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) throw new Error(j.error || "Nu am putut salva.");
      // the documents read (and the floor plan) go to the inspection's private storage
      for (const x of files) {
        const fd = new FormData(); fd.append("id", j.id); fd.append("kind", x.kind); fd.append("file", x.f); fd.append("name", x.f.name);
        await fetch("/api/inspectii/files", { method: "POST", body: fd }).catch(() => null);
      }
      location.href = files.length ? `/inspectii/${j.id}` : "/inspectii";
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!v.id || !confirm("Ștergi inspecția?")) return;
    await fetch("/api/inspectii", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: v.id }) });
    location.href = "/inspectii";
  }

  const tpl = tpls.find((t) => t.id === v.template_id);
  return (
    <div className="inForm">
      <div className="inFormMain">
        <section className="card">
          <h2><span className="inStep">1</span>Bunul</h2>
          {canRead && (
            <label className={`inDrop${reading ? " busy" : ""}`}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void readDoc(f); }}>
              <input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readDoc(f); e.target.value = ""; }} />
              <span><b>{reading ? "Citesc documentul…" : "Încarcă extrasul CF sau planul de amplasament"}</b><small>{reading ? "durează de obicei 20–60 de secunde" : "Le citim automat: adresa, nr. cadastral, CF, suprafața, poziția"}</small></span>
              {read.map((x) => <em key={x}>✓ {x}</em>)}
            </label>
          )}
          <div className="grid2">
            <label className="field span2">Adresa<input className="input" value={v.address} onChange={(e) => set("address", e.target.value)} placeholder="Str. Florilor nr. 7, Giroc, jud. Timiș" /></label>
            <label className="field">Nr. cadastral<input className="input" value={v.cad_nr} onChange={(e) => set("cad_nr", e.target.value)} /></label>
            <label className="field">Carte funciară<input className="input" value={v.cf_nr} onChange={(e) => set("cf_nr", e.target.value)} /></label>
            <label className="field">Tipul proprietății<select className="select" value={v.prop_type} onChange={(e) => set("prop_type", e.target.value)}>
              <option value="">—</option>{PROP_TYPES.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="field">Suprafață utilă (acte, mp)<input className="input" inputMode="decimal" value={v.area_util} onChange={(e) => set("area_util", e.target.value)} /></label>
            <label className="field">Teren (acte, mp)<input className="input" inputMode="decimal" value={v.area_land} onChange={(e) => set("area_land", e.target.value)} /></label>
          </div>
          <label className="inRlv">
            <input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFiles((x) => [...x.filter((y) => y.kind !== "releveu"), { f, kind: "releveu" }]); } e.target.value = ""; }} />
            <span className="btn btnGhost btnSm">{files.some((x) => x.kind === "releveu") ? `✓ Releveu: ${files.find((x) => x.kind === "releveu")!.f.name}` : "Atașează releveul"}</span>
            <small>se păstrează la inspecție; încăperile le scrii mai jos</small>
          </label>
          <div className="inRooms">
            <span className="field">Încăperi (din releveu) <small>apar gata în fișă, pe telefon</small></span>
            {v.rooms.map((r, i) => (
              <div key={i} className="inRoom">
                <input className="input" value={r.n} placeholder="ex. Living" aria-label="Încăperea" onChange={(e) => set("rooms", v.rooms.map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))} />
                <input className="input" value={r.a} placeholder="mp" inputMode="decimal" aria-label="Suprafața" onChange={(e) => set("rooms", v.rooms.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                <button type="button" className="btn btnGhost btnSm" aria-label="Scoate încăperea" onClick={() => set("rooms", v.rooms.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="btn btnGhost btnSm" onClick={() => set("rooms", [...v.rooms, { n: "", a: "" }])}>+ Încăpere</button>
          </div>
        </section>

        <section className="card">
          <h2><span className="inStep">2</span>Fișa de inspecție</h2>
          <div className="inTpls">
            {tpls.map((t) => (
              <button key={t.id} type="button" aria-pressed={v.template_id === t.id} onClick={() => set("template_id", t.id)}>
                <b>{t.name}</b><small>{t.owner}{t.enforced ? " · impusă de birou" : ""} · {qCount(t.tpl)} întrebări{t.version ? ` · v${t.version}` : ""}</small>
              </button>
            ))}
          </div>
          <p className="hint">Fișele se editează în <a className="rowLink" href="/inspectii/fise">Fișe de inspecție</a>. Inspecția păstrează versiunea fișei aleasă acum.</p>
        </section>

        <section className="card">
          <h2><span className="inStep">3</span>Contact și programare</h2>
          <div className="grid2">
            <label className="field">Persoana de contact<input className="input" value={v.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></label>
            <label className="field">Telefon<input className="input" inputMode="tel" value={v.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></label>
            <label className="field">Calitatea<select className="select" value={v.contact_role} onChange={(e) => set("contact_role", e.target.value)}>
              <option value="">—</option>{CONTACT_ROLES.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="field inLater"><span><input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} /> De programat mai târziu</span></label>
            {!later && <>
              <label className="field">Data<input className="input" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></label>
              <label className="field">Ora<input className="input" type="time" step={900} value={v.time} onChange={(e) => set("time", e.target.value)} /></label>
              <label className="field">Durata estimată<select className="select" value={v.duration_min} onChange={(e) => set("duration_min", +e.target.value)}>
                {[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} ${m === 60 ? "oră" : "ore"}`.replace(".5", ",5")}</option>)}</select></label>
            </>}
          </div>
        </section>

        <section className="card">
          <h2><span className="inStep">4</span>Cine face inspecția</h2>
          <div className="inWhoPick" role="radiogroup" aria-label="Cine face inspecția">
            {(Object.keys(ASSIGN_LABEL) as AssignKind[]).filter((k) => !(ops && k === "me")).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={v.assignee_kind === k} disabled={k === "office" && !team.length} onClick={() => set("assignee_kind", k)}>{ASSIGN_LABEL[k]}</button>
            ))}
          </div>
          {ops && <p className="hint" style={{ margin: 0 }}>Ai rol operațional: pregătești inspecția pentru firmă, iar un evaluator din birou o face.</p>}
          {v.assignee_kind === "office" && team.length > 0 && (
            <TeamPick team={team} value={v.assignee_id} onPick={(id) => set("assignee_id", id)} date={later ? "" : v.date} time={v.time} dur={v.duration_min} selfId={v.id} />
          )}
          {v.assignee_kind === "collab" && <p className="note">Inspecția așteaptă un coleg din Colaborări. Publică un anunț cu bunul; colegul ales o primește pe telefon, iar fișa, pozele și actele vin înapoi la tine. <a className="rowLink" href="/colaborari?compose=1">Pregătește anunțul →</a></p>}
          {!team.length && <p className="hint">„Din birou” apare când biroul are evaluatori: membri sau evaluatori asociați (Firma mea → Utilizatori).</p>}
        </section>
      </div>

      <aside className="inFormSide">
        <section className="card inSum">
          <b>{v.address || "Bunul"}</b>
          <small>{[v.prop_type, v.cad_nr && `nr. cad. ${v.cad_nr}`, v.lat != null ? "poziție găsită" : null].filter(Boolean).join(" · ") || "Completează datele bunului"}</small>
          <small>{tpl ? tpl.name : "Fișa nu e aleasă"}</small>
          <small>{later || !v.date ? "De programat" : `${v.date.split("-").reverse().join(".")}, ${v.time || "10:00"}`} · {v.assignee_kind === "office" && team.find((p) => p.id === v.assignee_id)?.name || ASSIGN_LABEL[v.assignee_kind]}</small>
        </section>
        {msg && <p className="note" role="alert">{msg}</p>}
        <button type="button" className="btn btnGold" disabled={busy} onClick={save}>{v.id ? "Salvează modificările" : "Salvează și trimite pe telefon"}</button>
        <a className="btn btnGhost" href="/inspectii">Renunță</a>
        {v.id && <button type="button" className="btn btnDanger" onClick={remove}>Șterge inspecția</button>}
        <p className="hint">Inspecția apare în aplicația de pe telefonul celui care o face, cu fișa, încăperile și persoana de contact.</p>
      </aside>
    </div>
  );
}
