import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { page, fmtDate } from "@/lib/guard";
import { canPrepare, getInspection, isOps, team } from "@/lib/insp";
import { InspReassign } from "@/components/InspReassign";
import { InspSheetDelete } from "@/components/InspSheetDelete";
import { InspDelete } from "@/components/InspDelete";
import { compSummary, coverPhoto, fmtWhen, photoCategories, STATUS } from "@/lib/insp-shared";
import { AppShell } from "@/components/AppShell";
import { InspDocActions } from "@/components/InspDocActions";
import { InspFileDelete, InspFileUpload } from "@/components/InspFileUpload";
import { InspCoverPick, InspShare } from "@/components/InspShare";
import { InspLocMap } from "@/components/InspLocMap";
import { InspTabs } from "@/components/InspTabs";
import { UserAv } from "@/components/UserAv";

export const metadata: Metadata = { title: "Fișa de inspecție | UVALO" };
export const dynamic = "force-dynamic";

const nf = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toLocaleString("ro-RO", { maximumFractionDigits: d }));
const ans = (v: string | string[] | undefined, unit?: string) => (Array.isArray(v) ? (v.length ? v.join(", ") : "—") : v ? `${v}${unit ? ` ${unit}` : ""}` : "—");
const TZ = "Europe/Bucharest";
/** "azi, 15:00 · 45 min", "vineri 7 nov, 09:00" */
function whenLong(at: string | null, dur?: number | null) {
  if (!at) return null;
  const day = at.slice(0, 10), time = at.slice(11, 16);
  const off = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  const d = new Date(`${day}T12:00:00Z`);
  const date = day === off(0) ? "azi" : day === off(1) ? "mâine" : day === off(-1) ? "ieri" : d.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  return `${date}${time ? `, ${time}` : ""}${dur ? ` · ${dur} min` : ""}`;
}
const short = (s: string | null | undefined) => (s ?? "").split(" ").slice(0, 2).join(" ");

/** The inspection page: the dark band (address, chips, actions), the steps, the tabs (Detalii / Fișa / Fotografii / Acte / Istoric) and the side cards. */
export default async function InspDoc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, c } = await page();
  if (!c.modules.includes("inspectii")) redirect("/inspectii");
  const x = await getInspection(db, c, id);
  if (!x) notFound();
  const done = x.status === "gata" || x.status === "pred";
  // who can take it over (only while it is not done, for who prepared it / the firm's viewers)
  const reassign = !done && !x.ro && canPrepare(c, x) ? await team(db, c, x.org_id) : null;
  // the sheet (a record of the property) can be deleted once it was started, and the inspection given again
  const sheetNo = x.sheet_no ?? null, sheetAt = x.sheet_at ?? null;
  const sheetStarted = !!(sheetNo || x.started_at || done || Object.keys(x.answers).length);
  const sheetTeam = sheetStarted && !x.ro && canPrepare(c, x) ? (reassign ?? await team(db, c, x.org_id)) : null;
  const redoNote = x.redo_note;
  // answers are shown once the phone has started (in progress, or sent back to complete)
  const shown = done || x.status === "lucru";
  // the firm the inspection belongs to: its logo heads the sheet (and the PDF)
  const firm = x.org_id ? await db.prepare("SELECT id, name, corp_no, logo IS NOT NULL AS has_logo FROM orgs WHERE id = ?").bind(x.org_id)
    .first<{ id: string; name: string; corp_no: string | null; has_logo: number }>() : null;
  const photos = x.files.filter((f) => f.kind === "photo"), docs = x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature");
  const sigFile = x.files.filter((f) => f.kind === "signature").at(-1) ?? null;
  const cover = coverPhoto(x.files, x.cover_file_id);
  const rooms = x.room_answers.length ? x.room_answers : x.rooms;
  const util = rooms.reduce((s, r) => s + (r.a ?? 0), 0);
  // the finishes per room: only when the sheet asks for them (or they were filled in before the option existed)
  const fin = !!x.template.rooms || x.room_answers.some((r) => (r as { floor?: string }).floor);
  const groups = x.template.groups;
  // UVALO sheets have their own "Constatări" group; older ones use the free-text findings
  const ownFind = groups.some((g) => g.id === "constatari");
  const answered = (qs: { id: string }[]) => qs.filter((q) => { const v = x.answers[q.id]; return Array.isArray(v) ? v.length > 0 : !!v; }).length;
  const qsAll = groups.flatMap((g) => g.qs), nAns = answered(qsAll);
  const pc = photoCategories(x.prop_type, x.template.photos), cats = [...pc.before, ...pc.after];
  const byCat = (cat: string) => photos.filter((p) => p.room === cat).length;
  const can = canPrepare(c, x);
  const lat = x.gps_lat ?? x.lat, lng = x.gps_lng ?? x.lng;
  const contactTel = x.contact_phone?.replace(/[^\d+]/g, "") ?? "";
  const deliveredAt = x.status === "pred" ? x.log.filter((l) => /predat/i.test(l.text)).at(-1)?.at ?? x.finished_at : null;

  /* ---------- the steps ---------- */
  const steps: { label: string; sub: string; state: "done" | "now" | "todo" }[] = [
    { label: "Pregătită", sub: `${fmtDate(x.created_at, true)} · ${x.owner_name === c.user.name ? "tu" : short(x.owner_name)}`, state: "done" },
    { label: "Programată", sub: x.scheduled_at ? `${whenLong(x.scheduled_at)} · ${x.assignee_name ? short(x.assignee_name) : "de ales"}` : "alege ziua și ora", state: x.scheduled_at ? "done" : "now" },
    { label: "Pe teren", sub: x.started_at ? `începută ${fmtDate(x.started_at, true)}` : "începe de pe telefon", state: x.started_at ? "done" : x.scheduled_at ? "now" : "todo" },
    { label: "Finalizată", sub: x.finished_at ? fmtDate(x.finished_at, true) : "semnată, trimisă", state: x.finished_at ? "done" : x.started_at ? "now" : "todo" },
    { label: "Predată", sub: deliveredAt ? fmtDate(deliveredAt, true) : "verificată pe web, predată", state: x.status === "pred" ? "done" : x.finished_at ? "now" : "todo" },
  ];

  const toc: [string, string, string][] = [
    ["rezumat", "·", "Rezumat"],
    ...groups.map((g, i) => [`g-${g.id}`, String(i + 1).padStart(2, "0"), g.name] as [string, string, string]),
    ["incaperi", String(groups.length + 1).padStart(2, "0"), `Încăperi${rooms.length ? ` (${rooms.length})` : ""}`],
    ...(ownFind ? [] : [["constatari", String(groups.length + 2).padStart(2, "0"), "Constatări"] as [string, string, string]]),
    ["fotografii-fisa", String(groups.length + 3 - (ownFind ? 1 : 0)).padStart(2, "0"), `Fotografii (${photos.length})`],
    ["acte-fisa", String(groups.length + 4 - (ownFind ? 1 : 0)).padStart(2, "0"), `Acte (${docs.length})`],
    ["locatie", String(groups.length + 5 - (ownFind ? 1 : 0)).padStart(2, "0"), "Locația inspecției"],
    ["semnaturi", String(groups.length + 6 - (ownFind ? 1 : 0)).padStart(2, "0"), "Semnături"],
  ];
  const sec = (no: string, title: string) => <h2 className="inH2"><span>{no}</span>{title}</h2>;

  const photoGrid = (list: typeof photos, pick: boolean) => (
    <div className="inPhotos">{list.map((p, i) => (
      <figure key={p.id}>
        <a className="inPhBox" href={`/api/inspectii/file/${p.id}`} target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/inspectii/file/${p.id}`} alt={p.room ?? p.name ?? "Fotografie"} loading="lazy" decoding="async" /><span className="inPhN">{i + 1}</span>
        </a>
        <figcaption><b>{p.room ?? p.name}</b><span>{p.taken_at ? fmtDate(p.taken_at, true) : ""}</span>{pick && <InspCoverPick id={x.id} fileId={p.id} on={cover?.id === p.id} />}<InspFileDelete id={p.id} /></figcaption>
      </figure>
    ))}</div>
  );
  const docList = (list: typeof docs) => (
    <ul className="inDocs">{list.map((d) => (
      <li key={d.id}><a href={`/api/inspectii/file/${d.id}`} target="_blank" rel="noopener"><span className="inDocIco">{d.kind === "cf" ? "CF" : d.kind === "releveu" ? "RLV" : "DOC"}</span>
        <b title={d.name ?? d.kind}>{d.name ?? d.kind}</b><small>{d.kind === "cf" ? "Extras de carte funciară" : d.kind === "releveu" ? "Releveu" : "Document"}</small></a><InspFileDelete id={d.id} /></li>
    ))}</ul>
  );
  const uploads = <span className="inUps"><InspFileUpload id={x.id} kind="cf" label="Adaugă extras CF" /><InspFileUpload id={x.id} kind="releveu" label="Adaugă releveu" /><InspFileUpload id={x.id} kind="doc" label="Alt document" /></span>;
  const logList = (list: typeof x.log) => <ol className="inLog">{list.map((l, i) => <li key={i}><span>{fmtDate(l.at, true)}</span>{l.text}{l.name ? ` · ${l.name}` : ""}</li>)}</ol>;

  /* ---------- the panels ---------- */
  const detalii = (
    <div className="ixCol">
      {redoNote && x.status === "lucru" && <div className="note inRedoNote"><b>Retrimisă pe telefon pentru completare.</b> {redoNote}
        <br /><small>{x.redo_prev_at ? `Fișa fusese completată pe ${fmtDate(x.redo_prev_at, true)}. ` : ""}{x.redo_keep_sig ? `Semnătura salvată${x.signed_name ? ` (${x.signed_name})` : ""} rămâne.` : "Se semnează din nou la final."}</small></div>}
      {x.status === "lucru" && !redoNote && <div className="note inLive"><b>În lucru pe telefon{x.assignee_name ? ` · ${x.assignee_name}` : ""}.</b> {nAns} din {qsAll.length} răspunsuri, {photos.length} {photos.length === 1 ? "fotografie" : "fotografii"}{(x as { updated_at?: string }).updated_at ? ` · actualizat ${fmtDate((x as { updated_at?: string }).updated_at, true)}` : ""}. Reîncarcă pagina ca să vezi ultimele date.</div>}

      <section className="ixCard">
        <h2>Proprietatea{can && !done && <a href={`/inspectii/nou?id=${x.id}`}>Modifică</a>}</h2>
        <div className="ixFacts">
          <div><small>Tip</small><b>{x.prop_type ?? "Imobil"}</b></div>
          <div><small>Nr. cadastral</small><b>{x.cad_nr ?? "—"}{x.cad_nr && x.uat ? <em> · {x.uat}</em> : null}</b></div>
          <div><small>Carte funciară</small><b>{x.cf_nr ?? "—"}</b></div>
          <div><small>UAT · județ</small><b>{[x.uat, x.county].filter(Boolean).join(" · ") || "—"}</b></div>
          <div><small>Suprafață utilă</small><b>{x.area_util ? `${nf(x.area_util)} mp` : "—"}{x.area_util ? <em> · din acte</em> : null}</b></div>
          <div><small>Teren</small><b>{x.area_land ? `${nf(x.area_land, 0)} mp` : "—"}{x.area_land ? <em> · din acte</em> : null}</b></div>
          <div><small>Încăperi din releveu</small><b>{x.rooms.length || "—"}{x.rooms.length ? <em> · {nf(x.rooms.reduce((s, r) => s + (r.a ?? 0), 0))} mp · {x.rooms.slice(0, 4).map((r) => r.n.toLowerCase()).join(", ")}{x.rooms.length > 4 ? "…" : ""}</em> : null}</b></div>
          <div><small>Client · utilizator</small><b>{x.ext_client ?? "—"}{x.ext_user ? <em> · {x.ext_user}</em> : null}</b></div>
          {(x.facts ?? []).map((f) => <div key={f.label}><small>{f.label}</small><b>{f.value}</b></div>)}
        </div>
      </section>

      <section className="ixCard">
        <h2>Fișa <small>· {x.template_name ?? "fișă"}{x.template_version ? ` v${x.template_version}` : ""} · {groups.length} grupuri · {qsAll.length} întrebări</small><a href="#fisa">Vezi fișa →</a></h2>
        <div className="ixGroups">
          {groups.map((g) => { const n = answered(g.qs), t = g.qs.length; return (
            <div key={g.id} className={`ixGrp${t && n === t ? " ok" : ""}`}><b>{g.name}</b><span className="ixBar"><i style={{ width: `${t ? Math.round((n / t) * 100) : 0}%` }} /></span><small>{n} / {t}</small></div>
          ); })}
          {!!x.template.rooms && <div className={`ixGrp${rooms.length && x.room_answers.every((r) => (r as { floor?: string }).floor) ? " ok" : ""}`}><b>Finisaje pe încăperi</b><span className="ixBar"><i style={{ width: `${rooms.length ? Math.round((x.room_answers.filter((r) => (r as { floor?: string }).floor).length / rooms.length) * 100) : 0}%` }} /></span><small>{x.room_answers.filter((r) => (r as { floor?: string }).floor).length} / {rooms.length}</small></div>}
          <div className={`ixGrp${photos.length ? " ok" : ""}`}><b>Fotografii</b><span className="ixBar"><i style={{ width: photos.length ? "100%" : "0%" }} /></span><small>{photos.length}</small></div>
        </div>
        <small className="ixNote">{done ? `Finalizată ${fmtDate(x.finished_at, true)}${x.signed_name ? ` · semnată de ${x.signed_name}` : ""}.` : x.status === "lucru" ? `Răspunsurile apar aici pe măsură ce ${short(x.assignee_name) || "inspectorul"} le completează pe telefon (la 4 secunde după fiecare schimbare).` : "Se completează pe telefon; răspunsurile apar aici pe măsură ce vin."}</small>
      </section>

      <section className="ixCard">
        <h2>Fotografii <small>· {photos.length ? `${photos.length} ${photos.length === 1 ? "poză" : "poze"}` : "încă nicio poză"}</small><a href="#fotografii">Toate →</a></h2>
        {photos.length ? (
          <div className="ixPh">{photos.slice(0, 6).map((p) => (
            <a key={p.id} href={`/api/inspectii/file/${p.id}`} target="_blank" rel="noopener" data-l={p.room ?? p.name ?? ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/inspectii/file/${p.id}`} alt={p.room ?? p.name ?? "Fotografie"} loading="lazy" decoding="async" />
            </a>
          ))}{photos.length > 6 && <a className="more" href="#fotografii">+{photos.length - 6}</a>}</div>
        ) : (
          <>
            <div className="ixPh ghost" aria-hidden="true">{cats.slice(0, 6).map((k) => <span key={k} data-l={k} />)}</div>
            <small className="ixNote">Categoriile fișei; pozele de pe telefon se așază în ele.</small>
          </>
        )}
      </section>

      {x.notes && <div className="ixInstr"><b>INSTRUCȚIUNI PENTRU INSPECTOR</b>{x.notes}</div>}
    </div>
  );

  const fisa = (
    <div className={`inDoc${done ? "" : " noToc"}`}>
      {done && (
        <nav className="inToc" aria-label="Cuprins">
          <div className="card">
            <span className="eyebrow">Cuprins</span>
            {toc.map(([h, no, l]) => <a key={h} href={`#${h}`}><span>{no}</span>{l}</a>)}
          </div>
        </nav>
      )}
      <article className="inPaper">
        {firm?.has_logo ? (
          <header className="inBrand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/org/logo/${firm.id}`} alt={firm.name} />
            <span><b>{firm.name}</b>{firm.corp_no && <small>Autorizație ANEVAR nr. {firm.corp_no}</small>}</span>
            <em>Fișă de inspecție<br />{sheetNo ?? x.code}{sheetAt ? <><br />{fmtDate(sheetAt)}</> : null}</em>
          </header>
        ) : null}
        {!done && <div className="note">{x.status === "lucru" ? "Fișa e în lucru pe telefon: răspunsurile de mai jos sunt cele trimise până acum." : `Inspecția nu a fost făcută încă${x.scheduled_at ? `: e programată pentru ${fmtWhen(x.scheduled_at)}` : ""}. Fișa se completează pe telefon și apare aici după finalizare.`}</div>}
        <section id="rezumat" className="inSec">
          {cover && (
            <figure className="inCover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/inspectii/file/${cover.id}`} alt={cover.room ?? "Poza de profil"} />
              <figcaption className="inNoPrint">Poza de profil{x.cover_file_id ? "" : " (prima de la exterior)"} · o schimbi din Fotografii</figcaption>
            </figure>
          )}
          <span className="eyebrow">Fișă de inspecție{sheetNo ? ` nr. ${sheetNo} din ${fmtDate(sheetAt ?? "")}` : ""} · {x.code}</span>
          <h1 className="inH1">{x.prop_type ?? "Imobil"}</h1>
          <p className="inLead">{[x.address, x.cad_nr && `nr. cad. ${x.cad_nr}`, x.cf_nr && `CF ${x.cf_nr}`].filter(Boolean).join(" · ")}</p>
          <div className="inKpis">
            <span><small>Suprafață utilă</small><b>{util ? `${nf(util)} mp` : x.area_util ? `${nf(x.area_util)} mp` : "—"}</b><em>{x.area_util ? `acte ${nf(x.area_util)} mp` : "din releveu"}</em></span>
            <span><small>Teren</small><b>{x.area_land ? `${nf(x.area_land, 0)} mp` : "—"}</b><em>din acte</em></span>
            <span><small>Inspecția</small><b>{x.finished_at ? fmtDate(x.finished_at) : fmtWhen(x.scheduled_at)}</b><em>{x.started_at && x.finished_at ? `${fmtDate(x.started_at, true).split(", ")[1] ?? ""} – ${fmtDate(x.finished_at, true).split(", ")[1] ?? ""}` : "programare"}</em></span>
            <span className="dark"><small>Făcută de</small><b>{x.assignee_name ?? "de ales"}</b><em>pentru {x.owner_name}</em></span>
          </div>
          <dl className="inMeta">
            {x.ext_user && <div><dt>Utilizatorul raportului</dt><dd>{x.ext_user}</dd></div>}
            {x.ext_client && <div><dt>Client</dt><dd>{x.ext_client}</dd></div>}
            <div><dt>Persoana de contact</dt><dd>{[x.contact_name, x.contact_role].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt>Telefon</dt><dd>{x.contact_phone || "—"}</dd></div>
            <div><dt>Fișa</dt><dd>{x.template_name ?? "—"}{x.template_version ? ` · v${x.template_version}` : ""}</dd></div>
            <div><dt>Nr. și data fișei</dt><dd>{sheetNo ? `${sheetNo} · ${fmtDate(sheetAt ?? "", true)}` : "se dau când începe completarea"}</dd></div>
            {(x.facts ?? []).map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
          </dl>
        </section>

        {groups.map((g, i) => (
          <section key={g.id} id={`g-${g.id}`} className="inSec">
            {sec(String(i + 1).padStart(2, "0"), g.name)}
            <div className="inRows">
              {g.qs.filter((q) => q.pdf !== false).map((q) => (
                <div key={q.id}><span>{q.t}</span><b>{shown ? (q.kind === "comp" ? compSummary(q, x.answers) || "—" : ans(x.answers[q.id], q.unit)) : "—"}</b></div>
              ))}
            </div>
          </section>
        ))}

        <section id="incaperi" className="inSec">
          {sec(String(groups.length + 1).padStart(2, "0"), "Încăperi")}
          {rooms.length ? (
            <table className="inRoomsTbl">
              <thead><tr><th>Poz.</th><th>Încăpere</th><th className="right">mp</th>{fin && <><th>Pardoseală</th><th>Pereți</th><th>Plafon</th><th>Stare</th></>}</tr></thead>
              <tbody>
                {rooms.map((r, i) => {
                  const ra = r as { floor?: string; walls?: string; ceiling?: string; state?: string };
                  return <tr key={i}><td className="acc">{i + 1}</td><td><b>{r.n}</b></td><td className="right">{nf(r.a)}</td>{fin && <><td>{ra.floor ?? "—"}</td><td>{ra.walls ?? "—"}</td><td>{ra.ceiling ?? "—"}</td><td>{ra.state ?? "—"}</td></>}</tr>;
                })}
                <tr className="tot"><td /><td><b>Suprafață utilă</b></td><td className="right"><b>{nf(util)}</b></td><td colSpan={fin ? 4 : 1}>{x.area_util ? `acte: ${nf(x.area_util)} mp · diferență ${util - x.area_util >= 0 ? "+" : ""}${nf(util - x.area_util)} mp` : ""}</td></tr>
              </tbody>
            </table>
          ) : <p className="hint">Încăperile din releveu nu au fost adăugate.</p>}
        </section>

        {!ownFind && <section id="constatari" className="inSec inFind">
          <h2 className="inH2 light"><span>{String(groups.length + 2).padStart(2, "0")}</span>Constatări</h2>
          <span>Diferențe față de acte</span><b>{x.findings.diff || "—"}</b>
          <span>Defecte vizibile</span><b>{x.findings.defects || "—"}</b>
          <span>Observații</span><b>{x.findings.notes || x.notes || "—"}</b>
        </section>}

        <section id="fotografii-fisa" className="inSec">
          {sec(String(groups.length + 3 - (ownFind ? 1 : 0)).padStart(2, "0"), "Fotografii")}
          {photos.length ? photoGrid(photos, true) : <p className="hint">Fotografiile vin din aplicația de telefon, cu ora și locul fiecăreia, grupate pe încăperi.</p>}
        </section>

        <section id="acte-fisa" className="inSec">
          {sec(String(groups.length + 4 - (ownFind ? 1 : 0)).padStart(2, "0"), "Acte")}
          {docs.length ? docList(docs) : <p className="hint">Niciun act atașat.</p>}
        </section>

        <section id="locatie" className="inSec">
          {sec(String(groups.length + 5 - (ownFind ? 1 : 0)).padStart(2, "0"), "Locația inspecției")}
          {x.gps_lat != null && x.gps_lng != null ? (() => {
            const la = x.gps_lat, ln = x.gps_lng;
            const addr: [number, number] | null = x.lat != null && x.lng != null ? [x.lat, x.lng] : null;
            const dAddr = addr ? Math.round(Math.hypot((la - addr[0]) * 111320, (ln - addr[1]) * 111320 * Math.cos((la * Math.PI) / 180))) : null;
            return (
              <div className="inLoc">
                <InspLocMap lat={la} lng={ln} acc={x.gps_acc ?? null} addr={addr} />
                <dl className="inLocFacts">
                  <dt>Coordonate</dt><dd>{la.toFixed(6)}, {ln.toFixed(6)}</dd>
                  <dt>Sursa</dt><dd>{x.gps_src === "manual" ? "pinul mutat manual pe hartă" : `GPS de pe telefon${x.gps_acc ? ` · precizie ±${Math.round(x.gps_acc)} m` : ""}`}</dd>
                  {x.gps_at && <><dt>Înregistrat</dt><dd>{fmtDate(x.gps_at, true)}</dd></>}
                  {dAddr != null && <><dt>Față de adresă</dt><dd>{dAddr < 15 ? "pe adresa din pregătire" : `la ${dAddr} m de adresa din pregătire`}</dd></>}
                  <dt className="inNoPrint">Deschide</dt><dd className="inNoPrint"><a href={`https://www.google.com/maps/search/?api=1&query=${la},${ln}`} target="_blank" rel="noopener">Google Maps ↗</a> · <a href={`/amplasament?lat=${la}&lng=${ln}`} target="_blank" rel="noopener">Analiză amplasament ↗</a></dd>
                </dl>
              </div>
            );
          })() : <p className="hint">Nu s-au înregistrat coordonate pe telefon. Poziția GPS se ia când se deschide fișa și se confirmă pe hartă înainte de semnătură.</p>}
        </section>

        <section id="semnaturi" className="inSec inSigns">
          <div><small>{String(groups.length + 6 - (ownFind ? 1 : 0)).padStart(2, "0")} · Persoana prezentă</small><b>{x.signed_name ?? "—"}</b>
            {/* the signature drawn on the phone (uploaded as a file of kind "signature"; the last one when it was taken again) */}
            {x.signed_at && sigFile ? <img className="inSignImg" src={`/api/inspectii/file/${sigFile.id}`} alt={`Semnătura: ${x.signed_name ?? "persoana prezentă"}`} /> : <span className="inSignLine" />}
            <em>{x.signed_at ? `Semnat pe telefon · ${fmtDate(x.signed_at, true)}` : "Semnătura se ia pe telefon"}</em></div>
          <div><small>Evaluator</small><b>{x.assignee_name ?? "—"}{x.assignee_legit ? <span className="inLegit"> · leg. {x.assignee_legit}</span> : null}</b>
            {x.finished_at && x.assignee_sig ? <img className="inSignImg" src={x.assignee_sig} alt={`Semnătura: ${x.assignee_name ?? "evaluator"}`} /> : <span className="inSignLine" />}
            <em>{x.finished_at && x.assignee_sig ? "Semnătura evaluatorului · din contul lui, aplicată la finalizare" : x.assignee_sig ? "Semnătura evaluatorului se aplică automat la finalizare" : "Semnătura evaluatorului"}</em></div>
        </section>
      </article>
    </div>
  );

  const fotografii = (
    <section className="ixCard">
      <h2>Fotografii <small>· {photos.length}</small></h2>
      {photos.length ? photoGrid(photos, true) : <p className="hint">Fotografiile vin din aplicația de telefon, cu ora și locul fiecăreia, grupate pe categorii: {cats.join(", ")}.</p>}
      {c.super && <InspFileUpload id={x.id} kind="photo" label="Adaugă fotografii (test)" accept="image/jpeg,image/png,image/webp" multiple />}
    </section>
  );
  const acte = (
    <section className="ixCard">
      <h2>Acte <small>· {docs.length}</small></h2>
      {docs.length ? docList(docs) : <p className="hint">Niciun act atașat. Extrasul CF și releveul se văd pe telefon, în timpul fișei.</p>}
      {!x.ro && uploads}
    </section>
  );
  const istoric = <section className="ixCard"><h2>Istoric <small>· {x.log.length}</small></h2>{logList(x.log)}</section>;

  return (
    <AppShell c={c} active="inspectii" dark title={x.address}
      subtitle={`${x.prop_type ?? "Imobil"} · ${x.code} · pregătită de ${x.owner_name}${x.org_name ? ` (${x.org_name})` : ""}, ${fmtDate(x.created_at, true)}`}
      actions={<a className="btn btnGhost" href="/inspectii">‹ Inspecții</a>}
      hero={
        <div className="ixHero">
          <div className="ixChips">
            <span className="ixChip" style={{ color: STATUS[x.status].fg, background: STATUS[x.status].bg }}>{x.assign_state === "pending" ? "Solicitare în așteptare" : STATUS[x.status].label}{x.scheduled_at && !done ? ` · ${whenLong(x.scheduled_at, x.duration_min)}` : done && x.finished_at ? ` · ${fmtDate(x.finished_at, true)}` : ""}</span>
            <span className="ixChip ghost">{x.prop_type ?? "Imobil"}</span>
            {x.template_name && <span className="ixChip ghost">{x.template_name}{x.template_version ? ` v${x.template_version}` : ""}</span>}
            <span className="ixChip ghost">Cod {x.code}</span>
            <span className="ixChip ghost" title={sheetNo ? `Dată la ${fmtDate(sheetAt ?? "", true)}` : "Se dă la primul răspuns de pe telefon"}>{sheetNo ? `Fișa ${sheetNo}` : "Nr. fișă: se dă la început"}</span>
            {x.test ? <span className="ixChip test">DATE DE TEST</span> : null}
            {x.ro ? <span className="ixChip" style={{ background: "#f4f0fa", color: "#7a5aa6" }}>DOAR CITIRE · asocierea cu {x.firm ?? "firma"} s-a încheiat</span> : null}
          </div>
          {!x.ro && <InspDocActions id={x.id} done={done} delivered={x.status === "pred"} canSimulate={c.super}
            canReopen={can} assignee={x.assignee_name} signer={x.signed_at ? x.signed_name : null}>
            {reassign && <InspReassign id={x.id} team={reassign} current={x.assignee_id} canMe={!isOps(c)} when={x.scheduled_at} dur={x.duration_min} started={x.status === "lucru"} />}
            {can && <InspShare id={x.id} token={x.share_token} />}
            {sheetTeam && <InspSheetDelete id={x.id} no={sheetNo} photos={photos.length} team={sheetTeam} current={x.assignee_id}
              currentName={x.assignee_name} canMe={!isOps(c)} when={x.scheduled_at} dur={x.duration_min} />}
            {can && <InspDelete id={x.id} address={x.address} done={done} />}
          </InspDocActions>}
        </div>
      }>
      <div className="ixSteps" aria-label="Pașii inspecției">
        {steps.map((s, i) => <div key={s.label} className={`ixStep ${s.state}`}><i>{s.state === "done" ? "✓" : i + 1}</i><span><b>{s.label}</b><small>{s.sub}</small></span></div>)}
      </div>

      <div className="ixBody">
        <div className="ixMain">
          <InspTabs initial={done ? "fisa" : "detalii"}
            tabs={[{ key: "detalii", label: "Detalii" }, { key: "fisa", label: "Fișa", count: done ? "✓" : `${nAns} / ${qsAll.length}` }, { key: "fotografii", label: "Fotografii", count: photos.length }, { key: "acte", label: "Acte", count: docs.length }, { key: "istoric", label: "Istoric", count: x.log.length }]}
            panels={{ detalii, fisa, fotografii, acte, istoric }} />
        </div>

        <aside className="ixSide">
          {lat != null && lng != null && (
            <section className="ixCard map">
              <div className="ixMapCard">
                <InspLocMap lat={lat} lng={lng} acc={x.gps_lat != null ? x.gps_acc ?? null : null} addr={x.gps_lat != null && x.lat != null && x.lng != null ? [x.lat, x.lng] : null} label={x.gps_lat != null ? "locul inspecției" : "adresa din pregătire"} />
                <a className="ixBtn ixMapBtn" href={`/localizare?adr=${lat.toFixed(6)},${lng.toFixed(6)}`}>Vezi în localizator ↗</a>
              </div>
              <div className="ixRow"><b>{x.address}</b><small>{lat.toFixed(4)} N · {lng.toFixed(4)} E{x.gps_lat != null ? " · de pe telefon" : ""}</small></div>
              <div className="ixActs">
                <a className="ixBtn" href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener">Google Maps</a>
                <a className="ixBtn" href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noopener">Waze</a>
                {c.modules.includes("amplasament") && <a className="ixBtn" href={`/amplasament?lat=${lat}&lng=${lng}`}>Analiză amplasament</a>}
              </div>
            </section>
          )}

          <section className="ixCard">
            <h2>Cine o face{reassign && <small>· se schimbă din „Realocă”, sus</small>}</h2>
            {x.assignee_id ? (
              <div className="ixWho">
                <UserAv id={x.assignee_id} name={x.assignee_name ?? "?"} has={x.assignee_av} size={40} />
                <span><b>{x.assignee_name}{x.assignee_id === c.user.id ? " (tu)" : ""}</b>
                  <small>{x.assignee_kind === "collab" ? "Coleg din Colaborări" : x.assignee_kind === "me" ? "Inspecția ta" : "Din birou"}{x.org_name ? ` · ${x.org_name}` : ""}</small>
                  {x.assign_state === "pending" ? <small className="warn">Solicitare trimisă · așteaptă acceptarea</small> : x.assign_state === "declined" ? <small className="bad">A refuzat · alege altcineva</small> : x.assignee_legit ? <small>Legitimație ANEVAR {x.assignee_legit}</small> : null}
                </span>
              </div>
            ) : <p className="hint">{x.assignee_kind === "collab" ? "Un coleg din Colaborări, de ales." : x.assign_state === "declined" ? "Solicitarea a fost refuzată: alege pe altcineva din bara de sus (Realocă)." : "Încă nealocată."}</p>}
          </section>

          <section className="ixCard">
            <h2>Programarea{can && !done && <a href={`/inspectii/nou?id=${x.id}`}>Reprogramează</a>}</h2>
            <div className="ixKv">
              <small>Când</small><b>{x.scheduled_at ? `${whenLong(x.scheduled_at)}${x.duration_min ? ` – ${x.duration_min} min` : ""}` : "de programat"}</b>
              {x.scheduled_at && !done && <><small>Memento</small><span>push pe telefon cu o oră înainte · și dimineața, la 7:00</span></>}
              {x.started_at && <><small>Începută</small><span>{fmtDate(x.started_at, true)}</span></>}
              {x.finished_at && <><small>Finalizată</small><span>{fmtDate(x.finished_at, true)}</span></>}
            </div>
          </section>

          <section className="ixCard">
            <h2>Contact la fața locului</h2>
            {x.contact_name || x.contact_phone ? (
              <>
                <div className="ixWho">
                  <span className="ixAv" aria-hidden="true">{(x.contact_name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}</span>
                  <span><b>{x.contact_name ?? "—"}</b><small>{x.contact_role ?? "Persoană de contact"}</small>{x.contact_phone && <small>{x.contact_phone}</small>}</span>
                </div>
                {contactTel && <div className="ixActs"><a className="ixBtn dark" href={`tel:${contactTel}`}>Sună</a><a className="ixBtn" href={`sms:${contactTel}`}>SMS</a></div>}
              </>
            ) : <p className="hint">Fără persoană de contact.</p>}
          </section>

          <section className="ixCard">
            <h2>Acte <small>· {docs.length}</small><a href="#acte">Toate →</a></h2>
            {docs.length ? docs.slice(0, 4).map((d) => (
              <a key={d.id} className="ixDoc" href={`/api/inspectii/file/${d.id}`} target="_blank" rel="noopener"><i>{d.kind === "cf" ? "CF" : d.kind === "releveu" ? "RLV" : "DOC"}</i><span><b>{d.name ?? d.kind}</b><small>{d.kind === "cf" ? "Extras de carte funciară" : d.kind === "releveu" ? "Releveu" : "Document"}</small></span></a>
            )) : <p className="hint">Niciun act atașat.</p>}
          </section>

          <section className="ixCard">
            <h2>Istoric<a href="#istoric">Tot →</a></h2>
            {[...x.log].reverse().slice(0, 4).map((l, i) => <div key={i} className="ixHist"><small>{fmtDate(l.at, true)}</small><span>{l.text}{l.name ? ` · ${l.name}` : ""}</span></div>)}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
