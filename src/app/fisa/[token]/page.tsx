import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireDb } from "@/lib/db";
import { fmtDate } from "@/lib/guard";
import { sharedInspection } from "@/lib/insp";
import { compSummary, coverPhoto, fmtWhen } from "@/lib/insp-shared";
import { origin } from "@/lib/site";

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
  return (
    <div className="fs">
      {/* only the valuation firm's brand on the public sheet (no UVALO logo) */}
      <header className="fsTop">
        {firm ? (
          <span className="fsFirm">
            {firm.has_logo ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src("logo")} alt={firm.name} /></> : null}
            <span><b>{firm.name}</b>{firm.corp_no && <small>Autorizație ANEVAR nr. {firm.corp_no}</small>}</span>
          </span>
        ) : <span className="fsFirm"><span><b>{x.assignee_name ?? x.owner_name}</b><small>Evaluator</small></span></span>}
        <span className="fsCode">Fișă de inspecție · {x.code}</span>
      </header>

      <section className={`fsHero${cover ? "" : " noImg"}`}>
        {cover && <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(cover.id)} alt={cover.room ?? "Imobilul"} />
        </>}
        <div className="fsHeroText">
          <span className="fsEyebrow">{x.prop_type ?? "Imobil"}</span>
          <h1>{x.address}</h1>
        </div>
      </section>

      <main className="fsMain">
        <div className="fsKpis">
          {kpis.filter(([, v]) => v).map(([k, v]) => <span key={k}><small>{k}</small><b>{v}</b></span>)}
        </div>

        {meta.some(([, v]) => v) && (
          <section className="fsCard">
            <h2>Imobilul</h2>
            <dl className="fsRows">{meta.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>
        )}

        {shown && groups.map((g) => (
          <section key={g.id} className="fsCard">
            <h2>{g.name}</h2>
            <dl className="fsRows">{g.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>
        ))}

        {rooms.length > 0 && (
          <section className="fsCard">
            <h2>Încăperi și finisaje</h2>
            <div className="fsRooms">
              {rooms.map((r, i) => {
                const ra = r as { floor?: string; walls?: string; ceiling?: string; state?: string };
                return (
                  <div key={i}>
                    <span className="fsRoomHead"><b>{i + 1}. {r.n}</b>{r.a ? <em>{nf(r.a)} mp</em> : null}</span>
                    {shown && <small>{[ra.floor && `Pardoseală: ${ra.floor}`, ra.walls && `Pereți: ${ra.walls}`, ra.ceiling && `Plafon: ${ra.ceiling}`, ra.state && `Stare: ${ra.state}`].filter(Boolean).join(" · ")}</small>}
                  </div>
                );
              })}
            </div>
            {util > 0 && <p className="fsTot">Suprafață utilă: <b>{nf(util)} mp</b></p>}
          </section>
        )}

        {shown && x.findings && (x.findings.diff || x.findings.defects || x.findings.notes) && (
          <section className="fsCard">
            <h2>Constatări</h2>
            <dl className="fsRows">
              {x.findings.diff && <div><dt>Diferențe față de acte</dt><dd>{x.findings.diff}</dd></div>}
              {x.findings.defects && <div><dt>Defecte vizibile</dt><dd>{x.findings.defects}</dd></div>}
              {x.findings.notes && <div><dt>Observații</dt><dd>{x.findings.notes}</dd></div>}
            </dl>
          </section>
        )}

        {byRoom.length > 0 && (
          <section className="fsCard">
            <h2>Fotografii · {photos.length}</h2>
            {byRoom.map(({ r, ph }) => (
              <div key={r} className="fsPhGroup">
                <h3>{r} <small>{ph.length}</small></h3>
                <div className="fsPhotos">
                  {ph.map((p) => (
                    <a key={p.id} href={src(p.id)} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src(p.id)} alt={r} loading="lazy" />
                      {p.taken_at && <span>{fmtDate(p.taken_at, true)}</span>}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="fsFoot">
        Fișă de inspecție {x.code}{firm ? ` · ${firm.name}` : ""}{firm?.corp_no ? ` · Autorizație ANEVAR nr. ${firm.corp_no}` : ""}
      </footer>
    </div>
  );
}
