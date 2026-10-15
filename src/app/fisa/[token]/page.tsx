import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireDb } from "@/lib/db";
import { fmtDate } from "@/lib/guard";
import { sharedInspection } from "@/lib/insp";
import { compSummary, coverPhoto, fmtWhen } from "@/lib/insp-shared";
import { origin } from "@/lib/site";
import { FsGallery, FsPrint } from "@/components/FsGallery";

export const dynamic = "force-dynamic";

const nf = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toLocaleString("ro-RO", { maximumFractionDigits: d }));
// questions about people (who was present, the owner, phone, e-mail) stay off the public page
const PRIVATE_Q = /prezent|persoan|contact|telefon|proprietar|chiria|e-?mail|\bnume\b|cnp|semn/i;
const ans = (v: string | string[] | undefined, unit?: string) => (Array.isArray(v) ? v.join(", ") : v ? `${v}${unit ? ` ${unit}` : ""}` : "");

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const x = await sharedInspection(await requireDb(), token).catch(() => null);
  if (!x) return { title: "Fișă de inspecție", robots: { index: false, follow: false } };
  const cover = coverPhoto(x.files, x.cover_file_id);
  // the valuation firm's brand only (its logo also as the tab icon), not UVALO's
  const db = await requireDb();
  const firm = x.org_id ? await db.prepare("SELECT name, logo IS NOT NULL AS has_logo FROM orgs WHERE id = ?").bind(x.org_id).first<{ name: string; has_logo: number }>() : null;
  const title = `${x.prop_type ?? "Imobil"} · ${x.address}`;
  const img = cover ? [`${await origin()}/api/fisa/${token}/${cover.id}`] : [];
  return {
    title: `${title} | Fișă de inspecție${firm ? ` · ${firm.name}` : ""}`, robots: { index: false, follow: false },
    ...(firm?.has_logo ? { icons: { icon: `/api/fisa/${token}/logo` } } : {}),
    openGraph: { title, description: `Fișă de inspecție ${x.code}${firm ? ` · ${firm.name}` : ""}`, siteName: firm?.name ?? "", images: img },
    // the app's own preview picture and name are not inherited
    twitter: { card: img.length ? "summary_large_image" : "summary", title, description: firm?.name ?? "", images: img },
  };
}

/**
 * The inspection sheet as a public web page (the "Link public" of /inspectii/<id>): no account, no contact person, phone,
 * documents or signature; the profile photo on top, the property, the answers, the rooms and the photos by category.
 */
export default async function SharedSheet({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await requireDb();
  const x = await sharedInspection(db, token);
  if (!x) notFound();
  const firm = x.org_id ? await db.prepare("SELECT name, corp_no, logo IS NOT NULL AS has_logo FROM orgs WHERE id = ?").bind(x.org_id)
    .first<{ name: string; corp_no: string | null; has_logo: number }>() : null;
  const src = (id: string) => `/api/fisa/${token}/${id}`;
  const cover = coverPhoto(x.files, x.cover_file_id);
  const photos = x.files.filter((f) => f.kind === "photo");
  const byRoom = [...new Set(photos.map((p) => p.room ?? "Altele"))].map((r) => ({ r, ph: photos.filter((p) => (p.room ?? "Altele") === r) }));
  const rooms = x.room_answers.length ? x.room_answers : x.rooms;
  const util = rooms.reduce((s, r) => s + (r.a ?? 0), 0);
  const fin = !!x.template.rooms || x.room_answers.some((r) => (r as { floor?: string }).floor);
  const shown = ["gata", "pred", "lucru"].includes(x.status);
  const groups = x.template.groups.map((g) => ({ ...g, qs: g.qs.filter((q) => q.pdf !== false && !PRIVATE_Q.test(q.t)) }))
    .map((g) => ({ ...g, rows: g.qs.map((q) => [q.t, q.kind === "comp" ? compSummary(q, x.answers) : ans(x.answers[q.id], q.unit)] as const).filter(([, v]) => v) }))
    .filter((g) => g.rows.length);
  const kpis: [string, string][] = [
    ["Suprafață utilă", util ? `${nf(util)} mp` : x.area_util ? `${nf(x.area_util)} mp` : ""],
    ["Teren", x.area_land ? `${nf(x.area_land, 0)} mp` : ""],
    ["Încăperi", rooms.length ? String(rooms.length) : ""],
    ["Inspecția", x.finished_at ? fmtDate(x.finished_at) : x.scheduled_at ? fmtWhen(x.scheduled_at) : ""],
  ];
  const meta: [string, string][] = [
    ["Nr. cadastral", x.cad_nr ?? ""], ["Carte funciară", x.cf_nr ?? ""], ["UAT", x.uat ?? ""], ["Județ", x.county ?? ""],
    ["Suprafață din acte", x.area_util ? `${nf(x.area_util)} mp` : ""], ["Evaluator", x.assignee_name ?? ""],
  ];
  const showFind = shown && x.findings && (x.findings.diff || x.findings.defects || x.findings.notes);
  const hasMeta = meta.some(([, v]) => v);
  // the section chips (sticky under the top bar)
  const nav: [string, string][] = [
    ...(hasMeta ? [["imobil", "Imobilul"] as [string, string]] : []),
    ...(shown ? groups.map((g) => [`g-${g.id}`, g.name] as [string, string]) : []),
    ...(rooms.length ? [["incaperi", "Încăperi"] as [string, string]] : []),
    ...(showFind ? [["constatari", "Constatări"] as [string, string]] : []),
    ...(photos.length ? [["foto", `Foto ${photos.length}`] as [string, string]] : []),
  ];
  const map = x.lat != null && x.lng != null ? `https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lng}` : null;
  const gallery = byRoom.map(({ r, ph }) => ({ r, ph: ph.map((p) => ({ id: p.id, src: src(p.id), room: r, when: p.taken_at ? fmtDate(p.taken_at, true) : "" })) }));
  return (
    <div className="fs">
      {/* only the valuation firm's brand on the public sheet (no UVALO logo) */}
      <header className="fsTop">
        {firm ? (
          <span className="fsFirm">
            {/* with a logo, the logo stands for the name; without one, the firm's name */}
            {firm.has_logo ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src("logo")} alt={firm.name} /></> : null}
            <span>{!firm.has_logo && <b>{firm.name}</b>}{firm.corp_no && <small>Autorizație ANEVAR nr. {firm.corp_no}</small>}</span>
          </span>
        ) : <span className="fsFirm"><span><b>{x.assignee_name ?? x.owner_name}</b><small>Evaluator</small></span></span>}
        <span className="fsCode">Fișă de inspecție<br />{x.code}</span>
      </header>

      <section className={`fsHero${cover ? "" : " noImg"}`}>
        {cover && <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(cover.id)} alt={cover.room ?? "Imobilul"} />
        </>}
        <div className="fsHeroText">
          <span className="fsEyebrow">{x.prop_type ?? "Imobil"}</span>
          <h1>{x.address}</h1>
          <span className="fsHeroBtns">
            {map && <a className="fsBtn" href={map} target="_blank" rel="noopener">Vezi pe hartă ↗</a>}
            <FsPrint />
          </span>
        </div>
      </section>

      {nav.length > 1 && (
        <nav className="fsNav" aria-label="Secțiuni">
          {nav.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
        </nav>
      )}

      <main className="fsMain">
        <div className="fsKpis">
          {kpis.filter(([, v]) => v).map(([k, v]) => <span key={k}><small>{k}</small><b>{v}</b></span>)}
        </div>

        {hasMeta && (
          <section id="imobil" className="fsCard">
            <h2>Imobilul</h2>
            <dl className="fsRows">{meta.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>
        )}

        {shown && groups.map((g) => (
          <section key={g.id} id={`g-${g.id}`} className="fsCard">
            <h2>{g.name}</h2>
            <dl className="fsRows">{g.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>
        ))}

        {rooms.length > 0 && (
          <section id="incaperi" className="fsCard">
            <h2>{fin ? "Încăperi și finisaje" : "Încăperi"}{util > 0 ? <small> · {nf(util)} mp utili</small> : null}</h2>
            <div className="fsTblWrap">
              <table className="fsTbl">
                <thead><tr><th>Încăpere</th><th className="r">mp</th>{shown && fin && <><th>Pardoseală</th><th>Pereți</th><th>Plafon</th><th>Stare</th></>}</tr></thead>
                <tbody>
                  {rooms.map((r, i) => {
                    const ra = r as { floor?: string; walls?: string; ceiling?: string; state?: string };
                    return (
                      <tr key={i}>
                        <td><b>{r.n}</b></td><td className="r">{r.a ? nf(r.a) : "—"}</td>
                        {shown && fin && <><td>{ra.floor ?? "—"}</td><td>{ra.walls ?? "—"}</td><td>{ra.ceiling ?? "—"}</td><td>{ra.state ?? "—"}</td></>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {showFind && (
          <section id="constatari" className="fsCard">
            <h2>Constatări</h2>
            <dl className="fsRows one">
              {x.findings.diff && <div><dt>Diferențe față de acte</dt><dd>{x.findings.diff}</dd></div>}
              {x.findings.defects && <div><dt>Defecte vizibile</dt><dd>{x.findings.defects}</dd></div>}
              {x.findings.notes && <div><dt>Observații</dt><dd>{x.findings.notes}</dd></div>}
            </dl>
          </section>
        )}

        {photos.length > 0 && (
          <section id="foto" className="fsCard">
            <h2>Fotografii <small>· {photos.length}</small></h2>
            <FsGallery groups={gallery} />
          </section>
        )}
      </main>

      <footer className="fsFoot">
        Fișă de inspecție {x.code}{firm ? ` · ${firm.name}` : ""}{firm?.corp_no ? ` · Autorizație ANEVAR nr. ${firm.corp_no}` : ""}
        {x.finished_at ? ` · ${fmtDate(x.finished_at)}` : ""}
      </footer>
    </div>
  );
}
