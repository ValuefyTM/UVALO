import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { page, fmtDate } from "@/lib/guard";
import { canPrepare, getInspection } from "@/lib/insp";
import { compSummary, coverPhoto, fmtWhen, STATUS } from "@/lib/insp-shared";
import { AppShell } from "@/components/AppShell";
import { InspDocActions } from "@/components/InspDocActions";
import { InspFileDelete, InspFileUpload } from "@/components/InspFileUpload";
import { InspCoverPick, InspShare } from "@/components/InspShare";

export const metadata: Metadata = { title: "Fișa de inspecție | UVALO" };
export const dynamic = "force-dynamic";

const nf = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toLocaleString("ro-RO", { maximumFractionDigits: d }));
const ans = (v: string | string[] | undefined, unit?: string) => (Array.isArray(v) ? (v.length ? v.join(", ") : "—") : v ? `${v}${unit ? ` ${unit}` : ""}` : "—");

/** The inspection as a document: table of contents on the left, the sheet on the right (prints as the PDF). */
export default async function InspDoc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, c } = await page();
  if (!c.modules.includes("inspectii")) redirect("/inspectii");
  const x = await getInspection(db, c, id);
  if (!x) notFound();
  const done = x.status === "gata" || x.status === "pred";
  const redoNote = (x as unknown as { redo_note?: string | null }).redo_note;
  // answers are shown once the phone has started (in progress, or sent back to complete)
  const shown = done || x.status === "lucru";
  // the firm the inspection belongs to: its logo heads the sheet (and the PDF)
  const orgId = (x as unknown as { org_id?: string | null }).org_id;
  const firm = orgId ? await db.prepare("SELECT id, name, corp_no, logo IS NOT NULL AS has_logo FROM orgs WHERE id = ?").bind(orgId)
    .first<{ id: string; name: string; corp_no: string | null; has_logo: number }>() : null;
  const photos = x.files.filter((f) => f.kind === "photo"), docs = x.files.filter((f) => f.kind !== "photo" && f.kind !== "signature");
  const cover = coverPhoto(x.files, x.cover_file_id);
  const rooms = x.room_answers.length ? x.room_answers : x.rooms;
  const util = rooms.reduce((s, r) => s + (r.a ?? 0), 0);
  const groups = x.template.groups;
  // UVALO sheets have their own "Constatări" group; older ones use the free-text findings
  const ownFind = groups.some((g) => g.id === "constatari");
  const toc: [string, string, string][] = [
    ["rezumat", "·", "Rezumat"],
    ...groups.map((g, i) => [`g-${g.id}`, String(i + 1).padStart(2, "0"), g.name] as [string, string, string]),
    ["incaperi", String(groups.length + 1).padStart(2, "0"), `Încăperi${rooms.length ? ` (${rooms.length})` : ""}`],
    ...(ownFind ? [] : [["constatari", String(groups.length + 2).padStart(2, "0"), "Constatări"] as [string, string, string]]),
    ["fotografii", String(groups.length + 3 - (ownFind ? 1 : 0)).padStart(2, "0"), `Fotografii (${photos.length})`],
    ["acte", String(groups.length + 4 - (ownFind ? 1 : 0)).padStart(2, "0"), `Acte (${docs.length})`],
    ["semnaturi", String(groups.length + 5 - (ownFind ? 1 : 0)).padStart(2, "0"), "Semnături"],
    ["istoric", "·", "Istoric"],
  ];
  const sec = (no: string, title: string) => <h2 className="inH2"><span>{no}</span>{title}</h2>;
  return (
    <AppShell c={c} active="inspectii" title={x.address} subtitle={`${x.code} · ${x.template_name ?? "fișă"}${x.template_version ? ` v${x.template_version}` : ""}`}
      actions={<a className="btn btnGhost" href="/inspectii">← Inspecții</a>}>
      <div className="inDocTop">
        <span className="inBadge" style={{ color: STATUS[x.status].fg, background: STATUS[x.status].bg }}>{STATUS[x.status].label}</span>
        {x.test ? <span className="inBadge inBadgeTest">DATE DE TEST</span> : null}
        {x.ro ? <span className="inBadge" style={{ background: "#f4f0fa", color: "#7a5aa6" }}>DOAR CITIRE · asocierea cu {x.firm ?? "firma"} s-a încheiat</span> : null}
        {!x.ro && <InspDocActions id={x.id} done={done} delivered={x.status === "pred"} canSimulate={c.super}
          canReopen={canPrepare(c, x)} assignee={x.assignee_name} signer={x.signed_at ? x.signed_name : null}>
          {canPrepare(c, x) && <InspShare id={x.id} token={x.share_token} />}
        </InspDocActions>}
      </div>
      {redoNote && x.status === "lucru" && <div className="note inRedoNote"><b>Retrimisă pe telefon pentru completare.</b> {redoNote}
        <br /><small>{x.redo_prev_at ? `Fișa fusese completată pe ${fmtDate(x.redo_prev_at, true)}. ` : ""}{x.redo_keep_sig ? `Semnătura salvată${x.signed_name ? ` (${x.signed_name})` : ""} rămâne.` : "Se semnează din nou la final."}</small></div>}
      {!done && x.status !== "lucru" && <div className="note">Inspecția nu a fost făcută încă{x.scheduled_at ? `: e programată pentru ${fmtWhen(x.scheduled_at)}` : ""}. Fișa se completează pe telefon; aici vezi ce s-a pregătit.</div>}

      <div className="inDoc">
        <nav className="inToc" aria-label="Cuprins">
          <div className="card">
            <span className="eyebrow">Cuprins</span>
            {toc.map(([h, no, l]) => <a key={h} href={`#${h}`}><span>{no}</span>{l}</a>)}
          </div>
        </nav>

        <article className="inPaper">
          {firm?.has_logo ? (
            <header className="inBrand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/org/logo/${firm.id}`} alt={firm.name} />
              <span><b>{firm.name}</b>{firm.corp_no && <small>Autorizație ANEVAR nr. {firm.corp_no}</small>}</span>
              <em>Fișă de inspecție<br />{x.code}</em>
            </header>
          ) : null}
          <section id="rezumat" className="inSec">
            {cover && (
              <figure className="inCover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/inspectii/file/${cover.id}`} alt={cover.room ?? "Poza de profil"} />
                <figcaption className="inNoPrint">Poza de profil{x.cover_file_id ? "" : " (prima de la exterior)"} · o schimbi din Fotografii</figcaption>
              </figure>
            )}
            <span className="eyebrow">Fișă de inspecție · {x.code}</span>
            <h1 className="inH1">{x.prop_type ?? "Imobil"}</h1>
            <p className="inLead">{[x.address, x.cad_nr && `nr. cad. ${x.cad_nr}`, x.cf_nr && `CF ${x.cf_nr}`].filter(Boolean).join(" · ")}</p>
            <div className="inKpis">
              <span><small>Suprafață utilă</small><b>{util ? `${nf(util)} mp` : x.area_util ? `${nf(x.area_util)} mp` : "—"}</b><em>{x.area_util ? `acte ${nf(x.area_util)} mp` : "din releveu"}</em></span>
              <span><small>Teren</small><b>{x.area_land ? `${nf(x.area_land, 0)} mp` : "—"}</b><em>din acte</em></span>
              <span><small>Inspecția</small><b>{x.finished_at ? fmtDate(x.finished_at) : fmtWhen(x.scheduled_at)}</b><em>{x.started_at && x.finished_at ? `${fmtDate(x.started_at, true).split(", ")[1] ?? ""} – ${fmtDate(x.finished_at, true).split(", ")[1] ?? ""}` : "programare"}</em></span>
              <span className="dark"><small>Făcută de</small><b>{x.assignee_name ?? "de ales"}</b><em>pentru {x.owner_name}</em></span>
            </div>
            <dl className="inMeta">
              <div><dt>Persoana de contact</dt><dd>{[x.contact_name, x.contact_role].filter(Boolean).join(", ") || "—"}</dd></div>
              <div><dt>Telefon</dt><dd>{x.contact_phone || "—"}</dd></div>
              <div><dt>Fișa</dt><dd>{x.template_name ?? "—"}{x.template_version ? ` · v${x.template_version}` : ""}</dd></div>
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
                <thead><tr><th>Poz.</th><th>Încăpere</th><th className="right">mp</th><th>Pardoseală</th><th>Pereți</th><th>Plafon</th><th>Stare</th></tr></thead>
                <tbody>
                  {rooms.map((r, i) => {
                    const ra = r as { floor?: string; walls?: string; ceiling?: string; state?: string };
                    return <tr key={i}><td className="acc">{i + 1}</td><td><b>{r.n}</b></td><td className="right">{nf(r.a)}</td><td>{ra.floor ?? "—"}</td><td>{ra.walls ?? "—"}</td><td>{ra.ceiling ?? "—"}</td><td>{ra.state ?? "—"}</td></tr>;
                  })}
                  <tr className="tot"><td /><td><b>Suprafață utilă</b></td><td className="right"><b>{nf(util)}</b></td><td colSpan={4}>{x.area_util ? `acte: ${nf(x.area_util)} mp · diferență ${util - x.area_util >= 0 ? "+" : ""}${nf(util - x.area_util)} mp` : ""}</td></tr>
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

          <section id="fotografii" className="inSec">
            {sec(String(groups.length + 3 - (ownFind ? 1 : 0)).padStart(2, "0"), "Fotografii")}
            {photos.length ? <div className="inPhotos">{photos.map((p, i) => (
              <figure key={p.id}>
                <a className="inPhBox" href={`/api/inspectii/file/${p.id}`} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/inspectii/file/${p.id}`} alt={p.room ?? p.name ?? "Fotografie"} loading="lazy" /><span className="inPhN">{i + 1}</span>
                </a>
                <figcaption><b>{p.room ?? p.name}</b><span>{p.taken_at ? fmtDate(p.taken_at, true) : ""}</span><InspCoverPick id={x.id} fileId={p.id} on={cover?.id === p.id} /><InspFileDelete id={p.id} /></figcaption>
              </figure>
            ))}</div>
              : <p className="hint">Fotografiile vin din aplicația de telefon, cu ora și locul fiecăreia, grupate pe încăperi.</p>}
            {c.super && <InspFileUpload id={x.id} kind="photo" label="Adaugă fotografii (test)" accept="image/jpeg,image/png,image/webp" multiple />}
          </section>

          <section id="acte" className="inSec">
            {sec(String(groups.length + 4 - (ownFind ? 1 : 0)).padStart(2, "0"), "Acte")}
            {docs.length ? <ul className="inDocs">{docs.map((d) => (
              <li key={d.id}><a href={`/api/inspectii/file/${d.id}`} target="_blank" rel="noopener"><span className="inDocIco">{d.kind === "cf" ? "CF" : d.kind === "releveu" ? "RLV" : "DOC"}</span>
                <b>{d.name ?? d.kind}</b><small>{d.kind === "cf" ? "Extras de carte funciară" : d.kind === "releveu" ? "Releveu" : "Document"}</small></a><InspFileDelete id={d.id} /></li>
            ))}</ul>
              : <p className="hint">Niciun act atașat. Extrasul CF și releveul încărcate la pregătire apar aici.</p>}
            <span className="inUps"><InspFileUpload id={x.id} kind="cf" label="Adaugă extras CF" /><InspFileUpload id={x.id} kind="releveu" label="Adaugă releveu" /><InspFileUpload id={x.id} kind="doc" label="Alt document" /></span>
          </section>

          <section id="semnaturi" className="inSec inSigns">
            <div><small>{String(groups.length + 5 - (ownFind ? 1 : 0)).padStart(2, "0")} · Persoana prezentă</small><b>{x.signed_name ?? "—"}</b><span className="inSignLine" /><em>{x.signed_at ? `Semnat pe telefon · ${fmtDate(x.signed_at, true)}` : "Semnătura se ia pe telefon"}</em></div>
            <div><small>Evaluator</small><b>{x.assignee_name ?? "—"}</b><span className="inSignLine" /><em>Semnătura evaluatorului</em></div>
          </section>

          <section id="istoric" className="inSec inNoPrint">
            {sec("·", "Istoric")}
            <ol className="inLog">{x.log.map((l, i) => <li key={i}><span>{fmtDate(l.at, true)}</span>{l.text}{l.name ? ` · ${l.name}` : ""}</li>)}</ol>
          </section>
        </article>
      </div>
    </AppShell>
  );
}
